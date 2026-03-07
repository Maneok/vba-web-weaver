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
    const { siren, dirigeants } = await req.json();
    if (!dirigeants || dirigeants.length === 0) {
      return new Response(JSON.stringify({ nodes: [], edges: [], alertes: [], status: "ok" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSiren = (siren ?? "").replace(/\s/g, "");
    const nodes: any[] = [];
    const edges: any[] = [];
    const alertes: any[] = [];
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

    for (const dir of (dirigeants as Array<{ nom: string; prenom: string; qualite: string }>).slice(0, 5)) {
      const fullName = `${dir.prenom ?? ""} ${dir.nom ?? ""}`.trim();
      if (!fullName || fullName.length < 3) continue;

      const personId = `person-${fullName.replace(/\s/g, "-").toLowerCase()}`;
      nodes.push({ id: personId, label: fullName, type: "person" });
      edges.push({ source: personId, target: `company-${cleanSiren}`, label: dir.qualite || "Dirigeant" });

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

          const dirMatch = (r.dirigeants ?? []).some((d: any) => {
            const dName = `${d.prenom ?? ""} ${d.nom ?? ""}`.trim().toLowerCase();
            return dName === fullName.toLowerCase() || dName.includes(dir.nom.toLowerCase());
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

            // Probleme 8: Build address from components, skip [nd]
            const addrParts: string[] = [];
            if (siege.numero_voie) addrParts.push(siege.numero_voie);
            if (siege.type_voie) addrParts.push(siege.type_voie);
            if (siege.libelle_voie) addrParts.push(siege.libelle_voie);
            if (siege.code_postal) addrParts.push(siege.code_postal);
            if (siege.libelle_commune) addrParts.push(siege.libelle_commune);
            let addr = addrParts.join(" ").toLowerCase().trim();
            if (!addr || addr.length < 5) {
              addr = (siege.geo_adresse ?? siege.adresse ?? "").toLowerCase().trim();
            }
            // Skip addresses containing [nd] or too short
            if (addr.length > 5 && !addr.includes("[nd]") && !addr.includes("nd ")) {
              if (!addressCounts[addr]) addressCounts[addr] = [];
              addressCounts[addr].push(r.nom_complet ?? rSiren);
            }

            if (r.date_creation) {
              const created = new Date(r.date_creation);
              const oneYearAgo = new Date();
              oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
              if (created > oneYearAgo) {
                recentCreations.push(r.nom_complet ?? rSiren);
              }
            }

            if (r.etat_administratif === "F" || r.etat_administratif === "C") {
              alertes.push({
                type: "societe_fermee",
                message: `Societe fermee dans le reseau : ${r.nom_complet} (SIREN ${rSiren})`,
                severity: "orange",
              });
            }
          }
        }

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
      totalCompanies: nodes.filter((n: any) => n.type === "company").length,
      totalPersons: nodes.filter((n: any) => n.type === "person").length,
      status: alertes.some((a: any) => a.severity === "red") ? "ALERTE" : alertes.length > 0 ? "ATTENTION" : "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: (error as Error).message,
      nodes: [],
      edges: [],
      alertes: [],
      status: "unavailable",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
