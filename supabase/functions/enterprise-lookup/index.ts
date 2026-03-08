const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Probleme 5: Mapping codes INSEE -> libelles
const FORMES_JURIDIQUES: Record<string, string> = {
  "1000": "Entrepreneur individuel",
  "1100": "Entrepreneur individuel",
  "1200": "Entrepreneur individuel",
  "1300": "Entrepreneur individuel",
  "5410": "SARL",
  "5411": "SARL",
  "5422": "SARL",
  "5426": "SARL",
  "5430": "SARL",
  "5431": "SARL",
  "5432": "SARL",
  "5442": "SARL",
  "5443": "SARL",
  "5451": "SARL",
  "5453": "SARL",
  "5460": "SARL",
  "5499": "EURL",
  "5498": "EURL",
  "5510": "SA",
  "5511": "SA",
  "5515": "SA",
  "5520": "SA",
  "5522": "SA",
  "5525": "SA",
  "5530": "SA",
  "5531": "SA",
  "5532": "SA",
  "5538": "SA",
  "5539": "SA",
  "5540": "SA",
  "5542": "SA",
  "5543": "SA",
  "5546": "SA",
  "5547": "SA",
  "5548": "SA",
  "5551": "SA",
  "5552": "SA",
  "5553": "SA",
  "5554": "SA",
  "5555": "SA",
  "5559": "SA",
  "5560": "SA",
  "5570": "SA",
  "5585": "SA",
  "5599": "SA",
  "5710": "SAS",
  "5720": "SASU",
  "6540": "SCI",
  "6541": "SCI",
  "6542": "SCI",
  "6543": "SCI",
  "6544": "SCI",
  "6551": "Societe civile",
  "6554": "Societe civile",
  "6558": "Societe civile",
  "6560": "SCP",
  "6561": "SCP",
  "6562": "SCP",
  "6563": "SCP",
  "6564": "SCP",
  "6565": "SCP",
  "6566": "SCP",
  "6577": "Societe civile",
  "6578": "Societe civile",
  "6585": "Societe civile",
  "6588": "Societe civile",
  "6589": "Societe civile",
  "6595": "Societe civile",
  "6596": "Societe civile",
  "6597": "Societe civile",
  "6598": "Societe civile",
  "6599": "Societe civile",
  "5191": "SELARL",
  "5192": "SELAS",
  "5193": "SELAFA",
  "5194": "SELCA",
  "5195": "SEL",
  "5196": "SELEURL",
  "5470": "SELARL",
  "9210": "Association loi 1901",
  "9220": "Syndicat",
  "9221": "Syndicat",
  "9222": "Syndicat",
  "9223": "Syndicat",
  "9224": "Syndicat",
  "9230": "Association loi 1901",
  "9240": "Association loi 1901",
  "5610": "SNC",
  "5615": "SNC",
  "5620": "SNC",
  "5625": "SNC",
  "5630": "SNC",
  "5631": "SNC",
  "5632": "SNC",
  "5800": "EARL",
  "2110": "ENTREPRISE INDIVIDUELLE",
  "2120": "ENTREPRISE INDIVIDUELLE",
  "2210": "ENTREPRISE INDIVIDUELLE",
  "2310": "ENTREPRISE INDIVIDUELLE",
  "2320": "ENTREPRISE INDIVIDUELLE",
  "2385": "ENTREPRISE INDIVIDUELLE",
  "2400": "ENTREPRISE INDIVIDUELLE",
  "2700": "ENTREPRISE INDIVIDUELLE",
  "2900": "ENTREPRISE INDIVIDUELLE",
};

function buildAddress(siege: any): string {
  // Probleme 2: Build address from components
  const parts: string[] = [];
  if (siege.numero_voie) parts.push(siege.numero_voie);
  if (siege.type_voie) parts.push(siege.type_voie);
  if (siege.libelle_voie) parts.push(siege.libelle_voie);

  const streetAddress = parts.join(" ").trim();

  if (streetAddress && streetAddress.length > 3) {
    return streetAddress.toUpperCase();
  }

  // Fallback to geo_adresse or adresse
  const fallback = siege.geo_adresse ?? siege.adresse ?? "";
  if (fallback && !fallback.includes("[nd]")) {
    return fallback.toUpperCase();
  }

  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode, query } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "query requis", results: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clean = (query as string).replace(/\s/g, "");

    let url: string;
    if (mode === "siren" && /^\d{9,14}$/.test(clean)) {
      url = `https://recherche-entreprises.api.gouv.fr/search?q=${clean.slice(0, 9)}`;
    } else {
      url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&page=1&per_page=5`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `API Annuaire: ${res.status}`, results: [], status: "unavailable" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();

    // Pappers enrichment (capital, tel, email, etc.)
    const pappersKey = Deno.env.get("PAPPERS");

    const results = await Promise.all((data.results ?? []).slice(0, 10).map(async (r: any) => {
      const siege = r.siege ?? {};
      const dirigeants = (r.dirigeants ?? []).map((d: any) => ({
        nom: d.nom ?? "",
        prenom: d.prenom ?? "",
        qualite: d.qualite ?? d.fonction ?? "",
        date_naissance: d.date_de_naissance ?? "",
        nationalite: d.nationalite ?? "",
      }));

      const dirigeantPrincipal = dirigeants.length > 0
        ? `${dirigeants[0].nom} ${dirigeants[0].prenom}`.trim().toUpperCase()
        : "";

      const siren9 = (r.siren ?? "").replace(/\s/g, "");

      // Probleme 5: Map forme juridique code to label
      const codeFormeJuridique = String(r.nature_juridique ?? "");
      const formeLabel = FORMES_JURIDIQUES[codeFormeJuridique] ?? r.libelle_nature_juridique ?? codeFormeJuridique;

      // Probleme 2: Better address parsing
      const adresse = buildAddress(siege);

      let capital = 0;
      let capitalSource = "";
      let telephone = "";
      let email = "";
      let siteWeb = "";
      let beneficiaires: any[] = [];
      let finances: any[] = [];
      let representants: any[] = [];
      let pappersAdresse = "";
      let pappersCp = "";
      let pappersVille = "";

      // CORRECTION 2: Capital priority — Pappers first, then Annuaire
      if (pappersKey && siren9) {
        try {
          const pRes = await fetch(
            `https://api.pappers.fr/v2/entreprise?api_token=${pappersKey}&siren=${siren9}`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (pRes.ok) {
            const pData = await pRes.json();
            // Capital from Pappers (priority 1)
            if (pData.capital && pData.capital > 0) {
              capital = pData.capital;
              capitalSource = "Pappers";
            }
            // Enrichment
            telephone = pData.telephone ?? "";
            email = pData.email ?? "";
            siteWeb = pData.site_web ?? "";
            // Address fallback from Pappers
            if (pData.siege) {
              pappersAdresse = pData.siege.adresse_ligne_1 ?? "";
              pappersCp = pData.siege.code_postal ?? "";
              pappersVille = pData.siege.ville ?? "";
            }
            // BE
            beneficiaires = (pData.beneficiaires_effectifs ?? []).map((be: any) => ({
              nom: be.nom ?? "",
              prenom: be.prenom ?? "",
              date_naissance: be.date_de_naissance_formatee ?? be.date_de_naissance ?? "",
              nationalite: be.nationalite ?? "",
              pourcentage_parts: be.pourcentage_parts ?? 0,
              pourcentage_votes: be.pourcentage_votes ?? 0,
            }));

            // Finances from Pappers (#5)
            if (pData.finances && Object.keys(pData.finances).length > 0) {
              // finances is keyed by year: { "2023": { ca, resultat, effectif, ... } }
              const years = Object.keys(pData.finances).sort().reverse();
              for (const yr of years.slice(0, 3)) {
                const f = pData.finances[yr];
                if (f) {
                  finances.push({
                    annee: yr,
                    ca: f.ca ?? f.chiffre_affaires ?? null,
                    resultat: f.resultat ?? null,
                    effectif: f.effectif ?? null,
                  });
                }
              }
            }

            // Representants with entreprises_dirigees (#12)
            representants = (pData.representants ?? []).map((rep: any) => ({
              nom: rep.nom ?? "",
              prenom: rep.prenom ?? "",
              qualite: rep.qualite ?? "",
              date_prise_de_poste: rep.date_prise_de_poste ?? "",
              entreprises_dirigees: (rep.entreprises_dirigees ?? []).map((ent: any) => ({
                siren: (ent.siren ?? "").replace(/\s/g, ""),
                denomination: ent.denomination ?? ent.nom_entreprise ?? "",
                qualite: ent.qualite ?? "",
                date_prise_de_poste: ent.date_prise_de_poste ?? "",
                statut_rcs: ent.statut_rcs ?? "",
                date_creation: ent.date_creation ?? "",
              })),
            }));
          }
        } catch {
          // Pappers unavailable
        }
      }
      // Capital fallback: Annuaire Entreprises (priority 3)
      if (!capital && (r.capital ?? 0) > 0) {
        capital = r.capital;
        capitalSource = "data.gouv";
      }

      return {
        siren: siren9 ? `${siren9.slice(0, 3)} ${siren9.slice(3, 6)} ${siren9.slice(6, 9)}` : "",
        siret: siege.siret ?? "",
        raison_sociale: (r.nom_complet ?? r.nom_raison_sociale ?? "").toUpperCase(),
        forme_juridique: formeLabel,
        forme_juridique_code: codeFormeJuridique,
        forme_juridique_raw: r.libelle_nature_juridique ?? formeLabel,
        adresse: adresse || pappersAdresse.toUpperCase(),
        code_postal: siege.code_postal || pappersCp || "",
        ville: (siege.libelle_commune ?? siege.commune ?? "").toUpperCase() || pappersVille.toUpperCase(),
        ape: siege.activite_principale ?? r.activite_principale ?? "",
        libelle_ape: siege.libelle_activite_principale ?? r.libelle_activite_principale ?? "",
        capital,
        capital_source: capitalSource,
        date_creation: r.date_creation ?? "",
        effectif: r.tranche_effectif_salarie ?? siege.tranche_effectif_salarie ?? "0 SALARIE",
        dirigeant: dirigeantPrincipal,
        dirigeants,
        telephone,
        email,
        site_web: siteWeb,
        beneficiaires_effectifs: beneficiaires,
        finances,
        representants,
        nombre_etablissements: r.nombre_etablissements ?? 1,
        etat_administratif: r.etat_administratif ?? "A",
        complements: r.complements ?? {},
        etablissements: (r.matching_etablissements ?? []).slice(0, 5).map((e: any) => ({
          siret: e.siret ?? "",
          adresse: e.adresse ?? "",
          commune: e.libelle_commune ?? "",
          est_siege: e.est_siege ?? false,
        })),
        source: "annuaire_entreprises",
      };
    }));

    return new Response(JSON.stringify({
      results,
      total: data.total_results ?? results.length,
      source: "annuaire_entreprises",
      status: "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message, results: [], status: "unavailable" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
