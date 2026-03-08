const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { siren, raison_sociale } = await req.json();
    if (!siren) {
      return new Response(JSON.stringify({ error: "siren requis", documents: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSiren = (siren as string).replace(/\s/g, "");
    const documents: any[] = [];
    let beneficiaires: any[] = [];
    let pappersData: any = null;

    // 1. INPI direct links (always available)
    documents.push({
      type: "KBIS",
      label: "Extrait INPI (RNE)",
      url: `https://data.inpi.fr/entreprises/${cleanSiren}`,
      source: "inpi",
      available: true,
      status: "lien",
    });

    // 2. Pappers API enrichment
    const pappersKey = Deno.env.get("PAPPERS");
    if (pappersKey) {
      try {
        const res = await fetch(
          `https://api.pappers.fr/v2/entreprise?api_token=${pappersKey}&siren=${cleanSiren}&extrait_rne=true`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (res.ok) {
          pappersData = await res.json();

          // Extrait Pappers (equivalent Kbis)
          if (pappersData.extrait_immatriculation_url) {
            documents.push({
              type: "KBIS",
              label: "Extrait Kbis (Pappers)",
              url: pappersData.extrait_immatriculation_url,
              source: "pappers",
              available: true,
              status: "auto",
            });
          }

          // Extrait RBE (#4)
          if (pappersData.extrait_rbe_url) {
            documents.push({
              type: "Extrait RBE",
              label: "Extrait RBE (Pappers)",
              url: pappersData.extrait_rbe_url,
              source: "pappers",
              available: true,
              status: "auto",
            });
          } else {
            documents.push({
              type: "Extrait RBE",
              label: "Voir les beneficiaires sur Pappers.fr",
              url: `https://www.pappers.fr/entreprise/${cleanSiren}#beneficiaires`,
              source: "pappers",
              available: true,
              status: "lien",
            });
          }

          // Statuts
          if (pappersData.derniers_statuts?.url) {
            documents.push({
              type: "Statuts",
              label: `Statuts — ${pappersData.derniers_statuts.date_depot ?? ""}`,
              url: pappersData.derniers_statuts.url,
              source: "pappers",
              available: true,
              status: "auto",
            });
          } else if (pappersData.derniers_statuts?.token) {
            documents.push({
              type: "Statuts",
              label: `Statuts — ${pappersData.derniers_statuts.date_depot ?? ""}`,
              url: `https://api.pappers.fr/v2/document/telechargement?api_token=${pappersKey}&token=${pappersData.derniers_statuts.token}`,
              source: "pappers",
              available: true,
              status: "auto",
            });
          }

          // Actes (statuts alternatifs)
          if (pappersData.actes?.length > 0) {
            const acte = pappersData.actes[0];
            if (acte.url || acte.token) {
              documents.push({
                type: "Actes",
                label: `Acte — ${acte.type ?? "Dernier acte"} — ${acte.date_depot ?? ""}`,
                url: acte.url ?? `https://api.pappers.fr/v2/document/telechargement?api_token=${pappersKey}&token=${acte.token}`,
                source: "pappers",
                available: true,
                status: "auto",
              });
            }
          }

          // Comptes annuels
          const comptes = pappersData.comptes ?? pappersData.derniers_comptes ? [pappersData.derniers_comptes] : [];
          const comptesArray = pappersData.comptes ?? comptes;
          for (const compte of (comptesArray ?? []).slice(0, 3)) {
            if (!compte) continue;
            if (compte.url || compte.token) {
              documents.push({
                type: "Comptes annuels",
                label: `Comptes ${compte.annee ?? ""} — ${compte.date_depot ?? ""}`,
                url: compte.url ?? `https://api.pappers.fr/v2/document/telechargement?api_token=${pappersKey}&token=${compte.token}`,
                source: "pappers",
                available: true,
                status: "auto",
              });
            }
          }

          // Other documents from Pappers
          const pappersDocs = pappersData.documents ?? [];
          for (const doc of pappersDocs.slice(0, 5)) {
            if (doc.url || doc.token) {
              documents.push({
                type: doc.type ?? "Document",
                label: `${doc.type ?? "Document"} — ${doc.date_depot ?? ""}`,
                url: doc.url ?? `https://api.pappers.fr/v2/document/telechargement?api_token=${pappersKey}&token=${doc.token}`,
                source: "pappers",
                available: true,
                status: "auto",
              });
            }
          }

          // Beneficiaires effectifs (Probleme 7)
          if (pappersData.beneficiaires_effectifs?.length > 0) {
            beneficiaires = pappersData.beneficiaires_effectifs.map((be: any) => ({
              nom: be.nom ?? "",
              prenom: be.prenom ?? "",
              date_naissance: be.date_de_naissance_formatee ?? be.date_de_naissance ?? "",
              nationalite: be.nationalite ?? "",
              pourcentage_parts: be.pourcentage_parts ?? 0,
              pourcentage_votes: be.pourcentage_votes ?? 0,
            }));

            documents.push({
              type: "Declaration BE",
              label: `${beneficiaires.length} beneficiaire(s) effectif(s) identifies`,
              url: `https://data.inpi.fr/entreprises/${cleanSiren}#beneficiaires`,
              source: "pappers",
              available: true,
              status: "auto",
            });
          }
        }
      } catch {
        // Pappers unavailable
      }
    }

    // 3. Auto-generated free links
    documents.push({
      type: "Annuaire",
      label: "Fiche Annuaire Entreprises",
      url: `https://annuaire-entreprises.data.gouv.fr/entreprise/${cleanSiren}`,
      source: "auto",
      available: true,
      status: "lien",
    });

    documents.push({
      type: "Pappers.fr",
      label: "Fiche Pappers (consultation gratuite)",
      url: `https://www.pappers.fr/entreprise/${cleanSiren}`,
      source: "auto",
      available: true,
      status: "lien",
    });

    documents.push({
      type: "Societe.com",
      label: "Fiche Societe.com",
      url: `https://www.societe.com/societe/${cleanSiren}.html`,
      source: "auto",
      available: true,
      status: "lien",
    });

    // Required docs checklist
    const requiredDocs = ["KBIS", "Statuts", "CNI", "RIB"];
    const foundTypes = documents.filter((d: any) => d.status === "auto").map((d: any) => d.type);
    const missing = requiredDocs.filter(r => !foundTypes.some(f => f.toUpperCase().includes(r.toUpperCase())));

    // Extract finances data from Pappers (#5)
    const finances: any = {};
    if (pappersData?.finances) {
      const years = Object.keys(pappersData.finances).sort().reverse();
      for (const yr of years.slice(0, 3)) {
        const f = pappersData.finances[yr];
        if (f) {
          finances[yr] = {
            ca: f.ca ?? f.chiffre_affaires ?? null,
            resultat: f.resultat ?? null,
            effectif: f.effectif ?? null,
          };
        }
      }
    }

    return new Response(JSON.stringify({
      documents,
      beneficiaires_effectifs: beneficiaires,
      finances,
      total: documents.length,
      autoRecovered: documents.filter((d: any) => d.status === "auto").length,
      missing,
      status: "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: (error as Error).message,
      documents: [],
      beneficiaires_effectifs: [],
      missing: ["KBIS", "Statuts", "CNI", "RIB"],
      status: "unavailable",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
