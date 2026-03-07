import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface NetworkNode {
  id: string;
  label: string;
  type: "company" | "person";
  siren?: string;
  isSource?: boolean;
  dateCreation?: string;
  ville?: string;
}

interface NetworkEdge {
  source: string;
  target: string;
  label: string;
}

interface NetworkAlert {
  type: "mandats_eleves" | "domiciliation_commune" | "creations_recentes" | "societe_fermee";
  message: string;
  severity: "orange" | "red";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { siren, dirigeants } = await req.json();
    if (!dirigeants || dirigeants.length === 0) {
      return new Response(JSON.stringify({ nodes: [], edges: [], alertes: [] }), { headers: CORS });
    }

    const cleanSiren = (siren ?? "").replace(/\s/g, "");
    const nodes: NetworkNode[] = [];
    const edges: NetworkEdge[] = [];
    const alertes: NetworkAlert[] = [];
    const seenSirens = new Set<string>();
    const addressCounts: Record<string, string[]> = {};

    // Add source company
    nodes.push({
      id: `company-${cleanSiren}`,
      label: "Client analyse",
      type: "company",
      siren: cleanSiren,
      isSource: true,
    });
    seenSirens.add(cleanSiren);

    // For each dirigeant, search other companies
    for (const dir of (dirigeants as Array<{ nom: string; prenom: string; qualite: string }>).slice(0, 5)) {
      const fullName = `${dir.prenom ?? ""} ${dir.nom ?? ""}`.trim();
      if (!fullName || fullName.length < 3) continue;

      const personId = `person-${fullName.replace(/\s/g, "-").toLowerCase()}`;
      nodes.push({ id: personId, label: fullName, type: "person" });
      edges.push({ source: personId, target: `company-${cleanSiren}`, label: dir.qualite || "Dirigeant" });

      // Search other companies by this person
      try {
        const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(fullName)}&page=1&per_page=20`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;

        const data = await res.json();
        const results = data.results ?? [];

        let mandatCount = 0;
        const recentCreations: string[] = [];

        for (const r of results) {
          const rSiren = (r.siren ?? "").replace(/\s/g, "");
          if (!rSiren || rSiren === cleanSiren) continue;

          // Check if this person is actually a dirigeant of this company
          const dirMatch = (r.dirigeants ?? []).some((d: any) => {
            const dName = `${d.prenom ?? ""} ${d.nom ?? ""}`.trim().toLowerCase();
            return dName === fullName.toLowerCase() ||
                   dName.includes(dir.nom.toLowerCase());
          });
          if (!dirMatch) continue;

          mandatCount++;

          if (!seenSirens.has(rSiren)) {
            seenSirens.add(rSiren);
            const siege = r.siege ?? {};
            const companyId = `company-${rSiren}`;
            nodes.push({
              id: companyId,
              label: (r.nom_complet ?? "").toUpperCase(),
              type: "company",
              siren: rSiren,
              dateCreation: r.date_creation ?? "",
              ville: (siege.libelle_commune ?? "").toUpperCase(),
            });
            edges.push({ source: personId, target: companyId, label: "Dirigeant" });

            // Track addresses for domiciliation commune detection
            const addr = (siege.adresse ?? siege.geo_adresse ?? "").toLowerCase().trim();
            if (addr.length > 5) {
              if (!addressCounts[addr]) addressCounts[addr] = [];
              addressCounts[addr].push(r.nom_complet ?? rSiren);
            }

            // Check recent creation
            if (r.date_creation) {
              const created = new Date(r.date_creation);
              const oneYearAgo = new Date();
              oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
              if (created > oneYearAgo) {
                recentCreations.push(r.nom_complet ?? rSiren);
              }
            }

            // Check if company is closed
            if (r.etat_administratif === "F" || r.etat_administratif === "C") {
              alertes.push({
                type: "societe_fermee",
                message: `Societe fermee dans le reseau : ${r.nom_complet} (SIREN ${rSiren})`,
                severity: "orange",
              });
            }
          }
        }

        // Alert: too many mandats
        if (mandatCount >= 10) {
          alertes.push({
            type: "mandats_eleves",
            message: `${fullName} dirige ${mandatCount}+ societes — nombre eleve de mandats`,
            severity: "red",
          });
        } else if (mandatCount >= 5) {
          alertes.push({
            type: "mandats_eleves",
            message: `${fullName} dirige ${mandatCount} societes`,
            severity: "orange",
          });
        }

        // Alert: recent creations
        if (recentCreations.length >= 2) {
          alertes.push({
            type: "creations_recentes",
            message: `${fullName} a cree ${recentCreations.length} societes recentes (< 1 an) : ${recentCreations.join(", ")}`,
            severity: "red",
          });
        }
      } catch {
        // Non-blocking per dirigeant
      }
    }

    // Alert: domiciliation commune
    for (const [addr, companies] of Object.entries(addressCounts)) {
      if (companies.length >= 2) {
        alertes.push({
          type: "domiciliation_commune",
          message: `Domiciliation commune detectee : ${companies.length} societes a la meme adresse (${addr.slice(0, 60)}...)`,
          severity: "orange",
        });
      }
    }

    return new Response(JSON.stringify({
      nodes,
      edges,
      alertes,
      totalCompanies: nodes.filter(n => n.type === "company").length,
      totalPersons: nodes.filter(n => n.type === "person").length,
      status: alertes.some(a => a.severity === "red") ? "ALERTE" : alertes.length > 0 ? "ATTENTION" : "OK",
    }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({
      error: String(err),
      nodes: [],
      edges: [],
      alertes: [],
      status: "ERREUR",
    }), { status: 500, headers: CORS });
  }
});
