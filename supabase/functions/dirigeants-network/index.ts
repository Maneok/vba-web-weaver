import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
    const dirigeants = Array.isArray(body?.dirigeants) ? body.dirigeants : [];
    if (dirigeants.length === 0) {
      return new Response(JSON.stringify({ nodes: [], edges: [], alertes: [], status: "ok" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSiren = String(body?.siren ?? "").replace(/[\s.\-]/g, "");
    if (cleanSiren && !/^\d{9,14}$/.test(cleanSiren)) {
      return new Response(JSON.stringify({ error: "Format SIREN invalide", nodes: [], edges: [], alertes: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

    // P5-13: Fetch Pappers data once and process all dirigeants in parallel
    let pappersReps: any[] = [];
    if (pappersKey) {
      try {
        const pRes = await fetch(
          `https://api.pappers.fr/v2/entreprise?api_token=${pappersKey}&siren=${cleanSiren}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (pRes.ok) {
          // P6-39: Guard against non-JSON Pappers response
          let pData: any;
          try { pData = await pRes.json(); } catch { pData = {}; }
          pappersReps = pData.representants ?? [];
        }
      } catch (error) {
        console.error("[dirigeants-network] Pappers fetch failed:", error);
      }
    }

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
      let matchingRepOuter: any = null;

      // Use pre-fetched Pappers data
      if (pappersReps.length > 0) {
        const matchingRep = pappersReps.find((rep: any) => {
          const rNom = normalize(rep.nom ?? "");
          const rPrenom = normalize(rep.prenom ?? "");
          return rNom === normNom && rPrenom === normPrenom;
        });

        matchingRepOuter = matchingRep;
        if (matchingRep?.entreprises_dirigees) {
          for (const ent of matchingRep.entreprises_dirigees) {
            const eSiren = (ent.siren ?? "").replace(/\s/g, "");
            if (!eSiren || eSiren === cleanSiren) continue;

            mandatCount++;

            if (!seenSirens.has(eSiren)) {
              seenSirens.add(eSiren);
              const companyId = `company-${eSiren}`;
              const companyAddr = (ent.siege?.code_postal ?? ent.code_postal ?? "").trim();
              nodes.push({
                id: companyId,
                label: ((ent.denomination ?? ent.nom_entreprise ?? "") || "").toUpperCase(),
                type: "company",
                siren: eSiren,
                dateCreation: ent.date_creation ?? "",
                ville: companyAddr,
              });
              // P6-41: Populate addressCounts for domiciliation commune detection
              if (companyAddr && companyAddr.length >= 3) {
                if (!addressCounts[companyAddr]) addressCounts[companyAddr] = [];
                addressCounts[companyAddr].push(ent.denomination ?? eSiren);
              }
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

      // #15: Count only active companies for mandat threshold
      let activeMandatCount = mandatCount;
      if (matchingRepOuter?.entreprises_dirigees) {
        activeMandatCount = (matchingRepOuter.entreprises_dirigees as any[]).filter((ent: any) => {
          const st = (ent.statut_rcs ?? "").toLowerCase();
          const ea = (ent.etat_administratif ?? "").toUpperCase();
          return st !== "radié" && st !== "radiée" && ea !== "F" && ea !== "C";
        }).length;
      }

      if (activeMandatCount >= 10) {
        alertes.push({
          type: "mandats_eleves",
          message: `${fullName} dirige ${activeMandatCount}+ societes actives — nombre eleve de mandats`,
          severity: "red",
        });
      } else if (activeMandatCount > 5) {
        alertes.push({
          type: "mandats_eleves",
          message: `${fullName} dirige ${activeMandatCount} societes actives`,
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
    console.error("[dirigeants-network] Error:", (error as Error).message);
    return new Response(JSON.stringify({
      error: "Erreur interne du service reseau dirigeants",
      nodes: [],
      edges: [],
      alertes: [],
      status: "unavailable",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
