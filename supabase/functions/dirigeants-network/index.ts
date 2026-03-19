import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// ====== INPI Auth (same pattern as enterprise-lookup) ======
const INPI_BASE = "https://registre-national-entreprises.inpi.fr/api";
let cachedToken: string | null = null;
let tokenExpiry = 0;
let tokenRefreshing: Promise<string | null> | null = null;

async function getINPIToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  if (tokenRefreshing) {
    try {
      return await Promise.race([
        tokenRefreshing,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Token refresh timeout")), 15000)),
      ]);
    } catch { return null; }
  }
  tokenRefreshing = _refreshINPIToken();
  try { return await tokenRefreshing; } finally { tokenRefreshing = null; }
}

async function _refreshINPIToken(): Promise<string | null> {
  const username = Deno.env.get("INPI_USERNAME");
  const password = Deno.env.get("INPI_PASSWORD");
  if (!username || !password) {
    console.error("[dirigeants-network][INPI] Missing credentials");
    return null;
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${INPI_BASE}/sso/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          cachedToken = data.token;
          tokenExpiry = Date.now() + 8 * 60 * 1000;
          console.log(`[dirigeants-network][INPI] Auth OK (attempt ${attempt})`);
          return data.token;
        }
      } else {
        const errBody = await res.text().catch(() => "");
        console.error(`[dirigeants-network][INPI] Auth failed attempt ${attempt}: HTTP ${res.status} — ${errBody.slice(0, 200)}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      console.error(`[dirigeants-network][INPI] Auth error attempt ${attempt}:`, (e as Error).message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

// ====== INPI search by dirigeant name ======
interface INPICompanyResult {
  siren: string;
  denomination: string;
  formeJuridique: string;
  etatAdministratif: string;
  dateCreation: string;
  codePostal: string;
  qualite: string;
}

async function searchINPIByDirigeant(
  token: string,
  nom: string,
  prenom: string,
  dateNaissance?: string,
): Promise<INPICompanyResult[]> {
  const params = new URLSearchParams({
    representant_nom: nom,
    representant_prenom: prenom,
    page: "1",
    pageSize: "20",
  });

  try {
    const res = await fetch(`${INPI_BASE}/companies?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(`[dirigeants-network][INPI] Search failed for ${prenom} ${nom}: HTTP ${res.status}`);
      return [];
    }

    let data: any;
    try { data = await res.json(); } catch { return []; }

    const results: any[] = data?.results ?? data?.companies ?? (Array.isArray(data) ? data : []);
    const companies: INPICompanyResult[] = [];

    for (const item of results) {
      const siren = String(item.siren ?? "").replace(/\s/g, "");
      if (!siren || siren.length < 9) continue;

      // Filter homonymes by date of birth if available
      if (dateNaissance && item.representants) {
        const reps = Array.isArray(item.representants) ? item.representants : [];
        const matchesDir = reps.some((r: any) => {
          const rNom = normalize(r.nom ?? r.nomPatronymique ?? "");
          const rPrenom = normalize(r.prenoms ?? r.prenom ?? "");
          const rDob = r.dateDeNaissance ?? r.date_de_naissance ?? "";
          return rNom === normalize(nom) && rPrenom.startsWith(normalize(prenom).slice(0, 3))
            && rDob && rDob === dateNaissance;
        });
        if (!matchesDir && reps.length > 0) continue; // skip homonyme
      }

      // Extract role from representants array
      let qualite = "Dirigeant";
      if (item.representants) {
        const reps = Array.isArray(item.representants) ? item.representants : [];
        const matchRep = reps.find((r: any) => {
          const rNom = normalize(r.nom ?? r.nomPatronymique ?? "");
          const rPrenom = normalize(r.prenoms ?? r.prenom ?? "");
          return rNom === normalize(nom) && rPrenom.startsWith(normalize(prenom).slice(0, 3));
        });
        if (matchRep) qualite = matchRep.qualite ?? matchRep.role ?? "Dirigeant";
      }

      const denomination = (
        item.denomination ?? item.nomComplet ?? item.nom_complet ?? ""
      ).toUpperCase();

      const forme = item.natureJuridique ?? item.formeJuridique ?? item.forme_juridique ?? "";
      const etat = item.etatAdministratif ?? item.etat_administratif ?? "A";
      const dateCreation = item.dateCreation ?? item.date_creation ?? item.dateImmatriculation ?? "";
      const cp = item.siege?.codePostal ?? item.codePostal ?? item.siege?.code_postal ?? "";

      companies.push({
        siren,
        denomination,
        formeJuridique: forme,
        etatAdministratif: etat,
        dateCreation,
        codePostal: cp,
        qualite,
      });
    }

    return companies;
  } catch (e) {
    console.error(`[dirigeants-network][INPI] Search error for ${prenom} ${nom}:`, (e as Error).message);
    return [];
  }
}

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  // Global timeout: 25s (Supabase cuts at 30s)
  const globalTimeout = AbortSignal.timeout(25000);

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
    // Track which sirens each person directs (for cross-link detection)
    const personSirens: Record<string, Set<string>> = {};

    nodes.push({
      id: `company-${cleanSiren}`,
      label: "Client analyse",
      type: "company",
      siren: cleanSiren,
      isSource: true,
    });
    seenSirens.add(cleanSiren);

    // ====== 1. INPI: search by dirigeant name (primary source) ======
    const inpiToken = await getINPIToken();
    let inpiUsed = false;

    const dirSlice = (dirigeants as Array<{ nom: string; prenom: string; qualite: string; dateNaissance?: string }>).slice(0, 5);

    if (inpiToken) {
      // Search all dirigeants in parallel
      const inpiResults = await Promise.allSettled(
        dirSlice.map(dir => {
          if (globalTimeout.aborted) return Promise.resolve([]);
          return searchINPIByDirigeant(inpiToken, dir.nom, dir.prenom, dir.dateNaissance);
        })
      );

      for (let i = 0; i < dirSlice.length; i++) {
        const dir = dirSlice[i];
        const fullName = `${dir.prenom ?? ""} ${dir.nom ?? ""}`.trim();
        if (!fullName || fullName.length < 3) continue;

        const personId = `person-${fullName.replace(/\s/g, "-").toLowerCase()}`;
        // Only add person node once
        if (!nodes.some(n => n.id === personId)) {
          nodes.push({ id: personId, label: fullName, type: "person" });
          edges.push({ source: personId, target: `company-${cleanSiren}`, label: dir.qualite || "Dirigeant" });
        }

        const settled = inpiResults[i];
        const companies = settled.status === "fulfilled" ? settled.value : [];

        if (companies.length > 0) inpiUsed = true;

        let mandatCount = 0;
        const recentCreations: string[] = [];
        const dirSirens = new Set<string>();

        for (const comp of companies) {
          if (!comp.siren || comp.siren === cleanSiren) continue;
          mandatCount++;
          dirSirens.add(comp.siren);

          if (!seenSirens.has(comp.siren)) {
            seenSirens.add(comp.siren);
            const companyId = `company-${comp.siren}`;
            nodes.push({
              id: companyId,
              label: comp.denomination,
              type: "company",
              siren: comp.siren,
              dateCreation: comp.dateCreation,
              ville: comp.codePostal,
              formeJuridique: comp.formeJuridique,
            });
            if (comp.codePostal && comp.codePostal.length >= 3) {
              if (!addressCounts[comp.codePostal]) addressCounts[comp.codePostal] = [];
              addressCounts[comp.codePostal].push(comp.denomination || comp.siren);
            }
          }

          const companyId = `company-${comp.siren}`;
          edges.push({ source: personId, target: companyId, label: comp.qualite || "Dirigeant" });

          // Alerte: société fermée
          if (comp.etatAdministratif === "F" || comp.etatAdministratif === "C") {
            alertes.push({
              type: "societe_fermee",
              message: `Societe fermee dans le reseau : ${comp.denomination} (SIREN ${comp.siren})`,
              severity: "orange",
            });
          }

          // Création récente (< 1 an)
          if (comp.dateCreation) {
            const created = new Date(comp.dateCreation);
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            if (created > oneYearAgo) {
              recentCreations.push(comp.denomination || comp.siren);
            }
          }
        }

        personSirens[personId] = dirSirens;

        // Alertes: mandats élevés (only count active companies)
        const activeMandatCount = companies.filter(c =>
          c.siren !== cleanSiren && c.etatAdministratif !== "F" && c.etatAdministratif !== "C"
        ).length;

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
    }

    // ====== 2. Fallback Pappers if INPI returned nothing and key exists ======
    if (!inpiUsed && pappersKey && !globalTimeout.aborted) {
      console.log("[dirigeants-network] INPI returned no results, falling back to Pappers");
      try {
        const pRes = await fetch(
          `https://api.pappers.fr/v2/entreprise?api_token=${pappersKey}&siren=${cleanSiren}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (pRes.ok) {
          let pData: any;
          try { pData = await pRes.json(); } catch { pData = {}; }
          const pappersReps = pData.representants ?? [];

          for (const dir of dirSlice) {
            const fullName = `${dir.prenom ?? ""} ${dir.nom ?? ""}`.trim();
            if (!fullName || fullName.length < 3) continue;

            const normNom = normalize(dir.nom ?? "");
            const normPrenom = normalize(dir.prenom ?? "");
            const personId = `person-${fullName.replace(/\s/g, "-").toLowerCase()}`;

            // Add person node if not already added by INPI path
            if (!nodes.some(n => n.id === personId)) {
              nodes.push({ id: personId, label: fullName, type: "person" });
              edges.push({ source: personId, target: `company-${cleanSiren}`, label: dir.qualite || "Dirigeant" });
            }

            const matchingRep = pappersReps.find((rep: any) => {
              const rNom = normalize(rep.nom ?? "");
              const rPrenom = normalize(rep.prenom ?? "");
              return rNom === normNom && rPrenom === normPrenom;
            });

            let mandatCount = 0;
            const recentCreations: string[] = [];
            const dirSirens = new Set<string>();

            if (matchingRep?.entreprises_dirigees) {
              for (const ent of matchingRep.entreprises_dirigees) {
                const eSiren = (ent.siren ?? "").replace(/\s/g, "");
                if (!eSiren || eSiren === cleanSiren) continue;

                mandatCount++;
                dirSirens.add(eSiren);

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

            personSirens[personId] = dirSirens;

            let activeMandatCount = mandatCount;
            if (matchingRep?.entreprises_dirigees) {
              activeMandatCount = (matchingRep.entreprises_dirigees as any[]).filter((ent: any) => {
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
        }
      } catch (error) {
        console.error("[dirigeants-network] Pappers fallback failed:", error);
      }
    }

    // ====== 3. Cross-link detection ======
    const personIds = Object.keys(personSirens);
    for (let i = 0; i < personIds.length; i++) {
      for (let j = i + 1; j < personIds.length; j++) {
        const p1 = personIds[i];
        const p2 = personIds[j];
        const s1 = personSirens[p1];
        const s2 = personSirens[p2];
        const shared = [...s1].filter(s => s2.has(s));
        if (shared.length > 0) {
          const p1Label = nodes.find(n => n.id === p1)?.label ?? p1;
          const p2Label = nodes.find(n => n.id === p2)?.label ?? p2;
          for (const sharedSiren of shared) {
            const sharedLabel = nodes.find(n => n.siren === sharedSiren)?.label ?? sharedSiren;
            alertes.push({
              type: "lien_croise",
              message: `Lien croise detecte : ${p1Label} et ${p2Label} dirigent ensemble ${sharedLabel} (SIREN ${sharedSiren})`,
              severity: "red",
            });
          }
        }
      }
    }

    // ====== 4. Domiciliation commune ======
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
      source: inpiUsed ? "INPI" : (pappersKey ? "Pappers" : "none"),
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
