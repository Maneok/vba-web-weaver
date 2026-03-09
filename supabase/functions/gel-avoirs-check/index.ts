import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

interface GelSanction {
  nom?: string;
  prenom?: string;
  denomination?: string;
  nature?: string;
  dateDesignation?: string;
  registreNationalDesSanctions?: string;
  [key: string]: unknown;
}

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Non autorise" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const nom = typeof body?.nom === "string" ? body.nom.slice(0, 200) : "";
    const prenom = typeof body?.prenom === "string" ? body.prenom.slice(0, 200) : "";
    const denominationEntreprise = typeof body?.denominationEntreprise === "string" ? body.denominationEntreprise.slice(0, 300) : "";

    if (!nom && !denominationEntreprise) {
      return new Response(
        JSON.stringify({ matches: [], checked: false, status: "ok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch latest DG Trésor gel d'avoirs list
    const res = await fetch(
      "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-et-sanctions",
      { signal: AbortSignal.timeout(15000) }
    );

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          matches: [],
          checked: true,
          status: "unavailable",
          error: `API DG Trésor HTTP ${res.status}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      return new Response(
        JSON.stringify({ matches: [], checked: true, status: "unavailable", error: "Reponse API DG Tresor non-JSON" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The API returns { publicationDate, sanctions: [...] } or similar structure
    const sanctions: GelSanction[] = data.sanctions ?? data.Sanctions ?? data.registreDesSanctions ?? [];

    if (sanctions.length === 0) {
      // Try alternative data path
      const registre = data.registreNationalDesGels ?? data.RegistreNationalDesGels ?? {};
      const personnes = registre.personnesPhysiques ?? registre.PersonnesPhysiques ?? [];
      const entites = registre.personnesMorales ?? registre.PersonnesMorales ?? registre.entites ?? [];
      sanctions.push(...personnes, ...entites);
    }

    const matches: Array<{
      matchedName: string;
      sanctionType: string;
      dateDesignation: string;
      nature: string;
      score: "exact" | "partial";
    }> = [];

    const searchTerms: string[] = [];
    if (nom) {
      const fullName = `${prenom ?? ""} ${nom}`.trim().toLowerCase();
      searchTerms.push(fullName);
      searchTerms.push(nom.toLowerCase());
    }
    if (denominationEntreprise) {
      searchTerms.push(denominationEntreprise.toLowerCase());
    }

    for (const sanction of sanctions) {
      const sanctionNames: string[] = [];

      // Collect all possible name fields
      if (sanction.nom) sanctionNames.push(sanction.nom.toLowerCase());
      if (sanction.prenom && sanction.nom) {
        sanctionNames.push(`${sanction.prenom} ${sanction.nom}`.toLowerCase());
      }
      if (sanction.denomination) sanctionNames.push(sanction.denomination.toLowerCase());

      // Also check nested name structures
      const alias = (sanction as Record<string, unknown>).alias;
      if (Array.isArray(alias)) {
        for (const a of alias) {
          if (typeof a === "string") sanctionNames.push(a.toLowerCase());
          if (typeof a === "object" && a && (a as Record<string, string>).nom) {
            sanctionNames.push((a as Record<string, string>).nom.toLowerCase());
          }
        }
      }

      for (const term of searchTerms) {
        for (const sName of sanctionNames) {
          if (!sName || sName.length < 2) continue;

          const isExact = sName === term || sName.includes(term) || term.includes(sName);
          // Partial: check each word
          const termWords = term.split(/\s+/).filter((w) => w.length > 2);
          const nameWords = sName.split(/\s+/).filter((w) => w.length > 2);
          const partialMatch =
            termWords.length > 0 &&
            termWords.every((tw) => nameWords.some((nw) => nw.includes(tw) || tw.includes(nw)));

          if (isExact || partialMatch) {
            matches.push({
              matchedName: sanction.nom
                ? `${sanction.prenom ?? ""} ${sanction.nom}`.trim()
                : sanction.denomination ?? sName,
              sanctionType: sanction.nature ?? "Gel d'avoirs",
              dateDesignation: sanction.dateDesignation ?? "",
              nature: sanction.nature ?? "Gel d'avoirs DG Trésor",
              score: isExact ? "exact" : "partial",
            });
            break; // One match per sanction entry is enough
          }
        }
      }
    }

    const hasMatch = matches.length > 0;
    const hasExactMatch = matches.some((m) => m.score === "exact");

    return new Response(
      JSON.stringify({
        matches,
        checked: true,
        totalSanctionsInList: sanctions.length,
        hasMatch,
        hasExactMatch,
        publicationDate: data.datePublication ?? data.DatePublication ?? null,
        status: hasMatch ? "ALERTE" : "ok",
        message: hasMatch
          ? `PERSONNE FIGURANT SUR LA LISTE DES GELS D'AVOIRS DU TRESOR (${matches.length} correspondance(s))`
          : "Aucune correspondance dans la liste des gels d'avoirs",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[gel-avoirs-check] Error:", (error as Error).message);
    return new Response(
      JSON.stringify({
        matches: [],
        checked: true,
        status: "unavailable",
        error: "Erreur interne du service gel d'avoirs",
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
