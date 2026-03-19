import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function normalizeUpper(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function personKey(nom: string, prenom: string): string {
  // Key = normalized surname + first token of firstname
  // This handles "ALEXANDRE" matching "ALEXANDRE GEORGES MOÏSE"
  const normNom = normalizeUpper(nom);
  const firstPrenom = normalizeUpper(prenom).split(/\s+/)[0] || "";
  return `${normNom}|${firstPrenom}`;
}

// Role code → label mapping (same as enterprise-lookup)
const QUALITE_LABELS: Record<string, string> = {
  "01": "Président du CA", "02": "Directeur général", "03": "Gérant",
  "04": "Administrateur", "05": "Président", "10": "Associé",
  "11": "Membre du conseil de surveillance", "15": "Commissaire aux comptes",
  "25": "Président du directoire", "30": "Liquidateur",
  "50": "Secrétaire général", "55": "Fondé de pouvoir",
  "70": "Membre", "71": "Associé-gérant", "72": "Co-gérant", "73": "Gérant non associé",
  "74": "Gérant associé", "75": "Représentant", "76": "Directeur général délégué",
};

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

// ====== Fetch company pouvoirs (representatives + linked companies) from INPI ======
interface CompanyPouvoirs {
  siren: string;
  denomination: string;
  formeJuridique: string;
  etatAdministratif: string;
  dateCreation: string;
  codePostal: string;
  individus: Array<{
    nom: string;
    prenom: string;
    role: string;
    dateNaissance: string;
  }>;
  entreprises: Array<{
    siren: string;
    denomination: string;
    formeJuridique: string;
    role: string;
  }>;
}

async function fetchCompanyPouvoirs(token: string, siren: string): Promise<CompanyPouvoirs | null> {
  try {
    const res = await fetch(`${INPI_BASE}/companies/${siren}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    let raw: any;
    try { raw = await res.json(); } catch { return null; }

    const formality = raw.formality ?? raw;
    const content = formality?.content ?? raw;
    const pm = content?.personneMorale;
    const pp = content?.personnePhysique;
    const creation = content?.natureCreation ?? {};
    const hasCessation = !!content?.natureCessation;

    let denomination = "";
    let codePostal = "";
    let formeJuridique = "";
    const individus: CompanyPouvoirs["individus"] = [];
    const entreprises: CompanyPouvoirs["entreprises"] = [];

    if (pm) {
      denomination = (pm.identite?.entreprise?.denomination ?? "").toUpperCase();
      formeJuridique = pm.identite?.entreprise?.formeJuridique ?? creation.formeJuridique ?? "";
      const adresse = pm.adresseEntreprise?.adresse ?? {};
      codePostal = adresse.codePostal ?? "";

      // Extract composition.pouvoirs
      const pouvoirs = pm.composition?.pouvoirs ?? [];
      for (const p of pouvoirs) {
        if (p.typeDePersonne === "INDIVIDU" && p.individu) {
          const desc = p.individu.descriptionPersonne ?? {};
          const prenoms = desc.prenoms ?? [];
          const prenom = Array.isArray(prenoms) ? (prenoms[0] ?? "") : String(prenoms);
          const roleCode = p.roleEntreprise ?? "";
          individus.push({
            nom: (desc.nom ?? "").toUpperCase(),
            prenom,
            role: QUALITE_LABELS[roleCode] ?? roleCode,
            dateNaissance: desc.dateDeNaissance ?? "",
          });
        } else if (p.typeDePersonne === "ENTREPRISE" && p.entreprise) {
          const ent = p.entreprise;
          const entSiren = (ent.siren ?? "").replace(/\s/g, "");
          if (entSiren && entSiren.length >= 9) {
            const roleCode = p.roleEntreprise ?? "";
            entreprises.push({
              siren: entSiren,
              denomination: (ent.denomination ?? "").toUpperCase(),
              formeJuridique: ent.formeJuridique ?? "",
              role: QUALITE_LABELS[roleCode] ?? roleCode,
            });
          }
        }
      }
    } else if (pp) {
      const desc = pp.identite?.entrepreneur?.descriptionPersonne ?? {};
      denomination = `${desc.prenoms?.[0] ?? ""} ${desc.nom ?? ""}`.trim().toUpperCase();
      formeJuridique = creation.formeJuridique ?? "";
      const adresse = pp.adresseEntreprise?.adresse ?? {};
      codePostal = adresse.codePostal ?? "";
    }

    const etat = hasCessation && (raw.nombreEtablissementsOuverts ?? 1) === 0 ? "F" : "A";
    const dateCreation = creation.dateCreation ?? pm?.identite?.entreprise?.dateImmat ?? "";

    return { siren, denomination, formeJuridique, etatAdministratif: etat, dateCreation, codePostal, individus, entreprises };
  } catch (e) {
    console.error(`[dirigeants-network][INPI] Fetch ${siren} error:`, (e as Error).message);
    return null;
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
    const personSirens: Record<string, Set<string>> = {};

    nodes.push({
      id: `company-${cleanSiren}`,
      label: "Client analyse",
      type: "company",
      siren: cleanSiren,
      isSource: true,
    });
    seenSirens.add(cleanSiren);

    const dirSlice = (dirigeants as Array<{ nom: string; prenom: string; qualite: string; dateNaissance?: string }>).slice(0, 5);

    // ====== 1. INPI: fetch client company pouvoirs + expand linked companies ======
    const inpiToken = await getINPIToken();
    let inpiUsed = false;

    if (inpiToken && !globalTimeout.aborted) {
      // Step 1: Fetch the client company's composition.pouvoirs
      const clientData = await fetchCompanyPouvoirs(inpiToken, cleanSiren);

      if (clientData) {
        inpiUsed = true;
        // Update source node label with actual denomination
        if (clientData.denomination) {
          nodes[0].label = clientData.denomination;
        }

        // Merge INPI individus + input dirigeants into a single deduplicated list
        const allPersons: Array<{ nom: string; prenom: string; role: string }> = [];
        const seenPersonKeys = new Set<string>();

        // Add INPI individus first (they have roles from pouvoirs)
        for (const ind of clientData.individus) {
          const key = personKey(ind.nom, ind.prenom);
          if (seenPersonKeys.has(key)) continue;
          seenPersonKeys.add(key);
          allPersons.push({ nom: ind.nom, prenom: ind.prenom, role: ind.role || "Dirigeant" });
        }

        // Add input dirigeants (may have more complete names)
        for (const dir of dirSlice) {
          const key = personKey(dir.nom ?? "", dir.prenom ?? "");
          if (seenPersonKeys.has(key)) {
            // Already exists — update label if this one is longer (more complete)
            const existing = allPersons.find(p => personKey(p.nom, p.prenom) === key);
            if (existing) {
              const fullExisting = `${existing.prenom} ${existing.nom}`.trim();
              const fullNew = `${dir.prenom ?? ""} ${dir.nom ?? ""}`.trim();
              if (fullNew.length > fullExisting.length) {
                existing.prenom = dir.prenom ?? existing.prenom;
              }
            }
            continue;
          }
          seenPersonKeys.add(key);
          allPersons.push({ nom: dir.nom ?? "", prenom: dir.prenom ?? "", role: dir.qualite || "Dirigeant" });
        }

        // Create person nodes from deduplicated list
        for (const person of allPersons) {
          const fullName = `${person.prenom} ${person.nom}`.trim();
          if (!fullName || fullName.length < 3) continue;
          const personId = `person-${normalizeUpper(fullName).replace(/\s+/g, "-").toLowerCase()}`;
          if (!nodes.some(n => n.id === personId)) {
            nodes.push({ id: personId, label: fullName, type: "person" });
            edges.push({ source: personId, target: `company-${cleanSiren}`, label: person.role });
            personSirens[personId] = new Set<string>();
          }
        }

        // Add ENTREPRISE entries from pouvoirs as linked companies
        for (const ent of clientData.entreprises) {
          if (!ent.siren || ent.siren === cleanSiren) continue;
          if (!seenSirens.has(ent.siren)) {
            seenSirens.add(ent.siren);
            nodes.push({
              id: `company-${ent.siren}`,
              label: ent.denomination,
              type: "company",
              siren: ent.siren,
              formeJuridique: ent.formeJuridique,
            });
          }
          // Edge: linked company → client company (as representative)
          edges.push({
            source: `company-${ent.siren}`,
            target: `company-${cleanSiren}`,
            label: ent.role || "Représentant",
          });
        }

        // Step 2: For each linked ENTREPRISE, fetch its pouvoirs to find cross-connections
        // Also fetch for each linked company the dirigeants to match with input dirigeants
        const linkedSirens = clientData.entreprises
          .map(e => e.siren)
          .filter(s => s && s !== cleanSiren);

        if (linkedSirens.length > 0 && !globalTimeout.aborted) {
          const linkedResults = await Promise.allSettled(
            linkedSirens.slice(0, 10).map(s => fetchCompanyPouvoirs(inpiToken, s))
          );

          for (let i = 0; i < linkedResults.length; i++) {
            const settled = linkedResults[i];
            if (settled.status !== "fulfilled" || !settled.value) continue;
            const linked = settled.value;

            // Update node with additional data
            const existingNode = nodes.find(n => n.siren === linked.siren);
            if (existingNode) {
              if (!existingNode.label && linked.denomination) existingNode.label = linked.denomination;
              existingNode.dateCreation = linked.dateCreation;
              existingNode.ville = linked.codePostal;
              existingNode.etatAdministratif = linked.etatAdministratif;
            }

            // Check if closed
            if (linked.etatAdministratif === "F" || linked.etatAdministratif === "C") {
              alertes.push({
                type: "societe_fermee",
                message: `Societe fermee dans le reseau : ${linked.denomination} (SIREN ${linked.siren})`,
                severity: "orange",
              });
            }

            // Track address for domiciliation commune
            if (linked.codePostal && linked.codePostal.length >= 3) {
              if (!addressCounts[linked.codePostal]) addressCounts[linked.codePostal] = [];
              addressCounts[linked.codePostal].push(linked.denomination || linked.siren);
            }

            // Check if any known persons also appear in this linked company
            for (const ind of linked.individus) {
              const indKey = personKey(ind.nom, ind.prenom);

              for (const person of allPersons) {
                const pKey = personKey(person.nom, person.prenom);
                if (indKey !== pKey) continue;

                const fullName = `${person.prenom} ${person.nom}`.trim();
                const personId = `person-${normalizeUpper(fullName).replace(/\s+/g, "-").toLowerCase()}`;

                // Create edge: person → linked company
                if (!edges.some(e => e.source === personId && e.target === `company-${linked.siren}`)) {
                  edges.push({
                    source: personId,
                    target: `company-${linked.siren}`,
                    label: ind.role || "Dirigeant",
                  });
                }
                if (personSirens[personId]) {
                  personSirens[personId].add(linked.siren);
                }
              }
            }

            // Add the linked company's own linked ENTREPRISES (depth 2)
            for (const ent2 of linked.entreprises) {
              if (!ent2.siren || ent2.siren === cleanSiren || ent2.siren === linked.siren) continue;
              if (!seenSirens.has(ent2.siren)) {
                seenSirens.add(ent2.siren);
                nodes.push({
                  id: `company-${ent2.siren}`,
                  label: ent2.denomination,
                  type: "company",
                  siren: ent2.siren,
                  formeJuridique: ent2.formeJuridique,
                });
              }
              edges.push({
                source: `company-${ent2.siren}`,
                target: `company-${linked.siren}`,
                label: ent2.role || "Représentant",
              });
            }
          }
        }

        // Step 3: For each input dirigeant, check if they appear as individu in the client company
        // and add mandat-related alerts
        for (const person of allPersons) {
          const fullName = `${person.prenom} ${person.nom}`.trim();
          if (!fullName || fullName.length < 3) continue;
          const personId = `person-${normalizeUpper(fullName).replace(/\s+/g, "-").toLowerCase()}`;
          const dirSirens = personSirens[personId] ?? new Set<string>();
          const activeMandatCount = dirSirens.size;

          if (activeMandatCount >= 10) {
            alertes.push({
              type: "mandats_eleves",
              message: `${fullName} dirige ${activeMandatCount}+ societes — nombre eleve de mandats`,
              severity: "red",
            });
          } else if (activeMandatCount > 5) {
            alertes.push({
              type: "mandats_eleves",
              message: `${fullName} dirige ${activeMandatCount} societes`,
              severity: "orange",
            });
          }
        }
      }
    }

    // ====== 2. Fallback Pappers if INPI returned nothing and key exists ======
    if (!inpiUsed && pappersKey && !globalTimeout.aborted) {
      console.log("[dirigeants-network] INPI unavailable, falling back to Pappers");
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
    // Also add client company address
    if (inpiUsed) {
      const clientNode = nodes.find(n => n.siren === cleanSiren);
      if (clientNode?.ville && clientNode.ville.length >= 3) {
        if (!addressCounts[clientNode.ville]) addressCounts[clientNode.ville] = [];
        addressCounts[clientNode.ville].push(clientNode.label || cleanSiren);
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
