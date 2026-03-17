import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

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

    // Fetch latest DG Trésor gel d'avoirs list (new endpoint since 2025-01-21)
    const res = await fetch(
      "https://gels-avoirs.dgtresor.gouv.fr/ApiPublic/api/v1/publication/derniere-publication-fichier-json",
      {
        headers: { "User-Agent": "GRIMY-LCB-Compliance/1.0" },
        signal: AbortSignal.timeout(30000),
      }
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

    const publications = data.Publications ?? data.publications ?? {};
    const items: any[] = publications.PublicationDetail ?? publications.publicationDetail ?? [];
    const publicationDate = publications.DatePublication ?? publications.datePublication ?? null;

    // Build search terms
    const searchTerms: string[] = [];
    if (nom) {
      const fullName = `${prenom ?? ""} ${nom}`.trim().toLowerCase();
      searchTerms.push(fullName);
      searchTerms.push(nom.toLowerCase());
    }
    if (denominationEntreprise) {
      searchTerms.push(denominationEntreprise.toLowerCase());
    }

    const matches: Array<{
      matchedName: string;
      sanctionType: string;
      dateDesignation: string;
      nature: string;
      score: "exact" | "partial";
    }> = [];

    for (const entry of items) {
      const entryNom: string = (entry.Nom ?? "").toLowerCase();
      if (!entryNom || entryNom.length < 2) continue;

      const nature: string = entry.Nature ?? "";
      const details: any[] = entry.RegistreDetail ?? [];

      // Collect all searchable names for this entry
      const sanctionNames: string[] = [entryNom];

      // Extract prénoms and build "prénom nom" combinations
      const prenomDetail = details.find((d: any) => d.TypeChamp === "PRENOM");
      const prenoms: string[] = [];
      if (prenomDetail?.Valeur && Array.isArray(prenomDetail.Valeur)) {
        for (const v of prenomDetail.Valeur) {
          const p = (v.Prenom ?? "").trim();
          if (p) {
            prenoms.push(p.toLowerCase());
            sanctionNames.push(`${p.toLowerCase()} ${entryNom}`);
          }
        }
      }

      // Extract aliases
      const aliasDetail = details.find((d: any) => d.TypeChamp === "ALIAS");
      if (aliasDetail?.Valeur && Array.isArray(aliasDetail.Valeur)) {
        for (const v of aliasDetail.Valeur) {
          const a = (v.Alias ?? "").trim();
          if (a && a.length >= 2) sanctionNames.push(a.toLowerCase());
        }
      }

      // Match against search terms
      for (const term of searchTerms) {
        let matched = false;
        for (const sName of sanctionNames) {
          if (!sName || sName.length < 2) continue;

          const isExact = sName === term
            || (term.length >= 4 && sName.includes(term))
            || (sName.length >= 4 && term.includes(sName));
          const termWords = term.split(/\s+/).filter((w) => w.length > 3);
          const nameWords = sName.split(/\s+/).filter((w) => w.length > 3);
          const partialMatch =
            termWords.length >= 2 &&
            nameWords.length >= 2 &&
            termWords.every((tw) => nameWords.some((nw) => nw === tw));

          if (isExact || partialMatch) {
            const displayName = prenoms.length > 0
              ? `${prenoms[0]} ${entry.Nom}`.trim()
              : entry.Nom ?? sName;
            matches.push({
              matchedName: displayName,
              sanctionType: nature,
              dateDesignation: "",
              nature: `Gel d'avoirs DG Trésor — ${nature}`,
              score: isExact ? "exact" : "partial",
            });
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }

    const hasMatch = matches.length > 0;
    const hasExactMatch = matches.some((m) => m.score === "exact");

    return new Response(
      JSON.stringify({
        matches,
        checked: true,
        totalSanctionsInList: items.length,
        hasMatch,
        hasExactMatch,
        publicationDate,
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
