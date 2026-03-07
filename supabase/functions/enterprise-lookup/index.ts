import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { mode, query } = await req.json();
    if (!query) return new Response(JSON.stringify({ error: "query requis" }), { status: 400, headers: CORS });

    const clean = (query as string).replace(/\s/g, "");

    // Primary: Annuaire Entreprises (free, no key, most reliable)
    let url: string;
    if (mode === "siren" && /^\d{9,14}$/.test(clean)) {
      url = `https://recherche-entreprises.api.gouv.fr/search?q=${clean.slice(0, 9)}`;
    } else {
      url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&page=1&per_page=5`;
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `API Annuaire: ${res.status}`, results: [] }), { headers: CORS });
    }

    const data = await res.json();
    const results = (data.results ?? []).slice(0, 10).map((r: any) => {
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

      return {
        siren: r.siren ? `${r.siren.slice(0, 3)} ${r.siren.slice(3, 6)} ${r.siren.slice(6, 9)}` : "",
        siret: siege.siret ?? "",
        raison_sociale: (r.nom_complet ?? r.nom_raison_sociale ?? "").toUpperCase(),
        forme_juridique: r.nature_juridique ?? "",
        forme_juridique_raw: r.libelle_nature_juridique ?? r.nature_juridique ?? "",
        adresse: (siege.adresse ?? siege.geo_adresse ?? "").toUpperCase(),
        code_postal: siege.code_postal ?? "",
        ville: (siege.libelle_commune ?? siege.commune ?? "").toUpperCase(),
        ape: siege.activite_principale ?? r.activite_principale ?? "",
        libelle_ape: siege.libelle_activite_principale ?? r.libelle_activite_principale ?? "",
        capital: r.capital ?? 0,
        date_creation: r.date_creation ?? "",
        effectif: r.tranche_effectif_salarie ?? siege.tranche_effectif_salarie ?? "0 SALARIE",
        dirigeant: dirigeantPrincipal,
        dirigeants,
        nombre_etablissements: r.nombre_etablissements ?? 1,
        statut_diffusion: r.statut_diffusion ?? "O",
        etat_administratif: r.etat_administratif ?? "A",
        etablissements: (r.matching_etablissements ?? []).slice(0, 5).map((e: any) => ({
          siret: e.siret ?? "",
          adresse: e.adresse ?? "",
          commune: e.libelle_commune ?? "",
          est_siege: e.est_siege ?? false,
        })),
        source: "annuaire_entreprises",
      };
    });

    return new Response(JSON.stringify({ results, total: data.total_results ?? results.length, source: "annuaire_entreprises" }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err), results: [] }), { status: 500, headers: CORS });
  }
});
