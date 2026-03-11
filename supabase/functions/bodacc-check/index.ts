import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { siren, complements } = await req.json();
    if (!siren) {
      return new Response(JSON.stringify({ error: "siren requis", annonces: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSiren = String(siren).replace(/[\s.\-]/g, "");
    if (!/^\d{9,14}$/.test(cleanSiren)) {
      return new Response(JSON.stringify({ error: "Format SIREN/SIRET invalide", annonces: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const procedureKeywords = [
      "redressement judiciaire", "liquidation judiciaire", "liquidation",
      "sauvegarde", "plan de cession", "plan de continuation",
      "jugement d'ouverture", "jugement de cloture",
    ];

    // Try BODACC API
    let annonces: any[] = [];
    let apiWorked = false;

    try {
      const url = `https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?where=registre%20like%20%22${cleanSiren}%22&limit=20&order_by=dateparution%20desc`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

      if (res.ok) {
        let data: any;
        try { data = await res.json(); } catch { data = null; }
        if (!data) throw new Error("Non-JSON response from BODACC API");
        apiWorked = true;
        const records = data.results ?? data.records ?? [];

        annonces = records.map((r: any) => {
          const fields = r.fields ?? r;
          const description = (fields.contenu ?? fields.annonce ?? fields.description ?? "").toLowerCase();
          const type = fields.familleavis ?? fields.typeavis ?? fields.nature ?? "";
          const isProcedureCollective = procedureKeywords.some(kw => description.includes(kw)) ||
            (type ?? "").toLowerCase().includes("procedure collective");

          return {
            date: fields.dateparution ?? fields.date_parution ?? "",
            type: type || "Annonce commerciale",
            description: (fields.contenu ?? fields.annonce ?? fields.description ?? "").slice(0, 300),
            tribunal: fields.tribunal ?? "",
            numero: fields.numerodepartement ?? fields.numero ?? "",
            isProcedureCollective,
          };
        });
      }
    } catch (error) {
      console.error("[bodacc-check]", error);
    }

    // Fallback: use complements.collecte_procol from enterprise-lookup
    let hasProcedureCollective = annonces.some((a: any) => a.isProcedureCollective);

    if (!apiWorked && complements) {
      const procol = complements.collecte_procol ?? complements.est_en_procedure_collective;
      if (procol === true || procol === "true") {
        hasProcedureCollective = true;
        annonces.push({
          date: "",
          type: "Procedure collective (source Annuaire Entreprises)",
          description: "Procedure collective detectee via les complements Annuaire Entreprises",
          tribunal: "",
          numero: "",
          isProcedureCollective: true,
        });
      }
    }

    const alertes: string[] = [];
    if (hasProcedureCollective) {
      const proc = annonces.find((a: any) => a.isProcedureCollective);
      alertes.push(`PROCEDURE COLLECTIVE DETECTEE : ${proc?.type} du ${proc?.date}`);
    }

    const venteFonds = annonces.filter((a: any) =>
      a.description.includes("vente") && a.description.includes("fonds")
    );
    if (venteFonds.length > 0) {
      alertes.push(`Vente de fonds de commerce detectee (${venteFonds[0].date})`);
    }

    return new Response(JSON.stringify({
      annonces: annonces.slice(0, 20),
      total: annonces.length,
      hasProcedureCollective,
      alertes,
      malus: hasProcedureCollective ? 30 : 0,
      status: hasProcedureCollective ? "ALERTE" : alertes.length > 0 ? "ATTENTION" : "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bodacc-check] Error:", (error as Error).message);
    return new Response(JSON.stringify({
      error: "Erreur interne du service BODACC",
      annonces: [],
      hasProcedureCollective: false,
      alertes: [],
      malus: 0,
      status: "unavailable",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
