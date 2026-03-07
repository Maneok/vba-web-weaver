import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface BodaccAnnonce {
  date: string;
  type: string;
  description: string;
  tribunal: string;
  numero: string;
  isProcedureCollective: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { siren, raison_sociale } = await req.json();
    if (!siren) {
      return new Response(JSON.stringify({ error: "siren requis" }), { status: 400, headers: CORS });
    }

    const cleanSiren = (siren as string).replace(/\s/g, "");

    // BODACC API via OpenDataSoft
    const url = `https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records?where=registre%20like%20%22${cleanSiren}%22&limit=20&order_by=dateparution%20desc`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      return new Response(JSON.stringify({
        annonces: [],
        hasProcedureCollective: false,
        alertes: [],
        error: `BODACC API: ${res.status}`,
      }), { headers: CORS });
    }

    const data = await res.json();
    const records = data.results ?? data.records ?? [];

    const procedureKeywords = [
      "redressement judiciaire", "liquidation judiciaire", "liquidation",
      "sauvegarde", "plan de cession", "plan de continuation",
      "jugement d'ouverture", "jugement de clôture",
    ];

    const annonces: BodaccAnnonce[] = records.map((r: any) => {
      const fields = r.fields ?? r;
      const description = (fields.contenu ?? fields.annonce ?? fields.description ?? "").toLowerCase();
      const type = fields.familleavis ?? fields.typeavis ?? fields.nature ?? "";
      const isProcedureCollective = procedureKeywords.some(kw => description.includes(kw)) ||
        (type ?? "").toLowerCase().includes("procédure collective") ||
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

    const hasProcedureCollective = annonces.some(a => a.isProcedureCollective);

    const alertes: string[] = [];
    if (hasProcedureCollective) {
      const proc = annonces.find(a => a.isProcedureCollective);
      alertes.push(`PROCEDURE COLLECTIVE DETECTEE : ${proc?.type} du ${proc?.date}`);
    }

    // Check for recent ventes de fonds de commerce
    const venteFonds = annonces.filter(a =>
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
      status: hasProcedureCollective ? "ALERTE" : alertes.length > 0 ? "ATTENTION" : "OK",
    }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({
      error: String(err),
      annonces: [],
      hasProcedureCollective: false,
      alertes: [],
      status: "ERREUR",
    }), { status: 500, headers: CORS });
  }
});
