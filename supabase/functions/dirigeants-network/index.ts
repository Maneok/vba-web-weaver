const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

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
    const pappersKey = Deno.env.get("PAPPERS");
    const nodes: any[] = [];
    const edges: any[] = [];
    const alertes: any[] = [];
    const seenSirens = new Set<string>();
    const addressCounts: Record<string, string[]> = {};

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

      const normNom = normalize(dir.nom ?? "");
      const normPrenom = normalize(dir.prenom ?? "");

      const personId = `person-${fullName.replace(/\s/g, "-").toLowerCase()}`;
      nodes.push({ id: personId, label: fullName, type: "person" });
      edges.push({ source: personId, target: `company-${cleanSiren}`, label: dir.qualite || "Dirigeant" });

      let mandatCount = 0;
      const recentCreations: string[] = [];

      // Strategy 1: Use Pappers API if available (most reliable)
      if (pappersKey) {
        try {
          // Search for this person's other companies via Pappers
          const pRes = await fetch(
            `https://api.pappers.fr/v2/entreprise?api_token=${pappersKey}&siren=${cleanSiren}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (pRes.ok) {
            const pData = await pRes.json();
            // Find the matching representant
            const reps = pData.representants ?? [];
            const matchingRep = reps.find((rep: any) => {
              const rNom = normalize(rep.nom ?? "");
              const rPrenom = normalize(rep.prenom ?? "");
              return rNom === normNom && rPrenom === normPrenom;
            });

            if (matchingRep?.entreprises_dirigees) {
              for (const ent of matchingRep.entreprises_dirigees) {
                const eSiren = (ent.siren ?? "").replace(/\s/g, "");
                if (!eSiren || eSiren === cleanSiren) continue;

                mandatCount++;

                if (!seenSirens.has(eSiren)) {
                  seenSirens.add(eSiren);
                  const companyId = `company-${eSiren}`;
                  nodes.push({
                    id: companyId,
                    label: (ent.denomination ?? ent.nom_entreprise ?? "").toUpperCase(),
                    type: "company",
                    siren: eSiren,
                    dateCreation: ent.date_creation ?? "",
                    ville: "",
                  });
                  const role = ent.qualite ?? matchingRep.qualite ?? "Dirigeant";
                  const dateNom = ent.date_prise_de_poste ?? "";
                  const edgeLabel = dateNom ? `${role} (${dateNom})` : role;
                  edges.push({ source: personId, target: companyId, label: edgeLabel });

                  if (ent.date_creation) {
                    const created = new Date(ent.date_creation);
                    const oneYearAgo = new Date();
                    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                    if (created > oneYearAgo) {
                      recentCreations.push(ent.denomination ?? eSiren);
                    }
                  }

                  if (ent.statut_rcs === "Radié" || ent.etat_administratif === "F") {
                    alertes.push({
                      type: "societe_fermee",
                      message: `Societe fermee dans le reseau : ${ent.denomination ?? ""} (SIREN ${eSiren})`,
                      severity: "orange",
                    });
                  }
                }
              }
            }
          }
        } catch {
          // Pappers failed, fallback to Annuaire below
        }
      }

      // Strategy 2: Fallback to Annuaire Entreprises if Pappers didn't find anything
      if (mandatCount === 0) {
        try {
          const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(fullName)}&page=1&per_page=20`;
          const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!res.ok) continue;

          const data = await res.json();
          const results = data.results ?? [];

          for (const r of results) {
            const rSiren = (r.siren ?? "").replace(/\s/g, "");
            if (!rSiren || rSiren === cleanSiren) continue;

            // CORRECTION 1: Exact nom+prenom match only (no partial match)
            const dirMatch = (r.dirigeants ?? []).some((d: any) => {
              const dNom = normalize(d.nom ?? "");
              const dPrenom = normalize(d.prenom ?? "");
              return dNom === normNom && dPrenom === normPrenom;
            });
            if (!dirMatch) continue;

            mandatCount++;

            if (!seenSirens.has(rSiren)) {
              seenSirens.add(rSiren);
              const siege = r.siege ?? {};
              const companyId = `company-${rSiren}`;
              // Find the matching dirigeant for role info
              const matchedDir = (r.dirigeants ?? []).find((d: any) => {
                const dNom = normalize(d.nom ?? "");
                const dPrenom = normalize(d.prenom ?? "");
                return dNom === normNom && dPrenom === normPrenom;
              });
              const role = matchedDir?.qualite ?? matchedDir?.fonction ?? "Dirigeant";

              nodes.push({
                id: companyId,
                label: (r.nom_complet ?? "").toUpperCase(),
                type: "company",
                siren: rSiren,
                dateCreation: r.date_creation ?? "",
                ville: (siege.libelle_commune ?? "").toUpperCase(),
              });
              edges.push({ source: personId, target: companyId, label: role });

              // Address for domiciliation detection
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
        } catch {
          // Non-blocking
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
