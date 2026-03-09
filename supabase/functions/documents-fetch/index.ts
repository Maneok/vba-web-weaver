import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const INPI_BASE = "https://registre-national-entreprises.inpi.fr/api";

// ====== INPI Auth with token cache ======
let cachedToken: string | null = null;
let tokenExpiry = 0;
let tokenRefreshing: Promise<string | null> | null = null;

async function getINPIToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  // Prevent thundering herd: reuse in-flight refresh
  // FIX P4-4: Add 20s timeout to prevent indefinite hanging
  if (tokenRefreshing) {
    try {
      return await Promise.race([
        tokenRefreshing,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Token refresh timeout")), 20000)),
      ]);
    } catch { return null; }
  }
  tokenRefreshing = _refreshINPIToken();
  try { return await tokenRefreshing; } finally { tokenRefreshing = null; }
}

async function _refreshINPIToken(): Promise<string | null> {
  const username = Deno.env.get("INPI_USERNAME");
  const password = Deno.env.get("INPI_PASSWORD");
  if (!username || !password) { console.log("[docs] No INPI credentials"); return null; }

  try {
    const res = await fetch(`${INPI_BASE}/sso/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.error(`[docs] INPI auth failed: ${res.status}`); return null; }
    const data = await res.json();
    if (data.token) {
      cachedToken = data.token;
      tokenExpiry = Date.now() + 8 * 60 * 1000;
      console.log("[docs] INPI auth OK");
      return data.token;
    }
    return null;
  } catch (e) {
    console.error("[docs] INPI auth error:", (e as Error).message);
    return null;
  }
}

// Download PDF from INPI and store in Supabase Storage
// FIX 2: Added PDF header validation (matching inpi-documents)
// FIX 3: Added token invalidation on 401
// FIX 33: Retry logic with exponential backoff for transient failures
async function downloadAndStore(
  supabaseClient: any,
  token: string,
  url: string,
  storagePath: string,
  retries = 2,
): Promise<string | null> {
  let currentDlToken = token;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        console.log(`[docs] Retry ${attempt}/${retries} after ${delay}ms for ${url}`);
        await new Promise(r => setTimeout(r, delay));
      }
      console.log(`[docs] Downloading ${url}`);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${currentDlToken}`,
          Accept: "application/pdf, application/octet-stream, */*",
        },
        redirect: "follow",
        // FIX P4-39: Increase download timeout to 45s
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[docs] Download failed: ${res.status} ${res.statusText} for ${url} — ${errBody.substring(0, 200)}`);
        // FIX P4-22: Retry on 401 with fresh token
        if (res.status === 401) {
          cachedToken = null; tokenExpiry = 0;
          if (attempt < retries) {
            const freshToken = await getINPIToken();
            if (freshToken) currentDlToken = freshToken;
            continue;
          }
        }
        // FIX 34: Retry on 429 (rate limit) and 5xx (server errors)
        if ((res.status === 429 || res.status >= 500) && attempt < retries) continue;
        return null;
      }

    const arrayBuffer = await res.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    console.log(`[docs] Downloaded ${uint8.length} bytes → ${storagePath}`);

    // FIX 2: Validate PDF header — reject HTML login pages and tiny files
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 10));
    const headerStr = String.fromCharCode(...headerBytes);
    const isPDF = headerStr.startsWith("%PDF");
    const isHTML = headerStr.toLowerCase().startsWith("<!doc") || headerStr.toLowerCase().startsWith("<html");

    // FIX P4-23: HTML response = auth redirect — retry with fresh token
    if (isHTML) {
      console.error(`[docs] HTML detected instead of PDF — likely auth redirect`);
      cachedToken = null;
      tokenExpiry = 0;
      if (attempt < retries) {
        const freshToken = await getINPIToken();
        if (freshToken) currentDlToken = freshToken;
        continue;
      }
      return null;
    }
    if (!isPDF && arrayBuffer.byteLength < 100) {
      console.error(`[docs] File too small and not PDF: ${arrayBuffer.byteLength} bytes`);
      return null;
    }

    const { error } = await supabaseClient.storage
      .from("kyc-documents")
      .upload(storagePath, uint8, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("[docs] Storage upload error:", error.message);
      return null;
    }

    // FIX 5: Use createSignedUrl for private bucket instead of getPublicUrl
    const { data: signedData, error: signError } = await supabaseClient.storage
      .from("kyc-documents")
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60); // 7 days

    if (signError || !signedData?.signedUrl) {
      console.error("[docs] Signed URL error:", signError?.message);
      // P5-17: Don't fallback to public URL — bucket is private, public URLs won't work and expose path info
      return null;
    }

    console.log(`[docs] Stored OK: ${storagePath}`);
    return signedData.signedUrl;
    } catch (e) {
      console.error(`[docs] Download/store error (attempt ${attempt + 1}):`, (e as Error).message);
      if (attempt >= retries) return null;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  const optRes = handleCorsOptions(req);
  if (optRes) return optRes;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { siren, raison_sociale } = await req.json();
    if (!siren) {
      return new Response(JSON.stringify({ error: "siren requis", documents: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FIX 31: Truncate SIRET (14 digits) to SIREN (9 digits) for INPI API
    let cleanSiren = String(siren).replace(/[\s.\-]/g, "");
    if (!/^\d{9,14}$/.test(cleanSiren)) {
      return new Response(JSON.stringify({ error: "Format SIREN invalide", documents: [], status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cleanSiren.length === 14) cleanSiren = cleanSiren.slice(0, 9);
    const documents: any[] = [];
    let beneficiaires: any[] = [];
    const sources: string[] = [];
    let inpiSuccess = false;

    // Initialize Supabase client for storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Ensure bucket exists
    try {
      const { data: buckets } = await supabaseClient.storage.listBuckets();
      console.log(`[docs] Buckets: ${(buckets ?? []).map((b: any) => b.name).join(", ")}`);
      if (!buckets?.find((b: any) => b.name === "kyc-documents")) {
        await supabaseClient.storage.createBucket("kyc-documents", { public: false });
        console.log("[docs] Bucket kyc-documents created");
      }
    } catch (e) {
      console.error("[docs] Bucket check error:", (e as Error).message);
    }

    // FIX 48: Check for existing stored documents before re-downloading
    let existingPaths: string[] = [];
    try {
      const { data: existing } = await supabaseClient.storage
        .from("kyc-documents")
        .list(cleanSiren, { limit: 50 });
      existingPaths = (existing ?? []).map((f: any) => `${cleanSiren}/${f.name}`);
      if (existingPaths.length > 0) {
        console.log(`[docs] Found ${existingPaths.length} existing files for ${cleanSiren}`);
      }
    } catch {
      // Non-critical
    }

    // ====== PHASE 1: INPI Documents (primary source) ======
    const token = await getINPIToken();
    if (token) {
      try {
        console.log(`[docs] GET /companies/${cleanSiren}/attachments`);
        const res = await fetch(`${INPI_BASE}/companies/${cleanSiren}/attachments`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          // P6-11: Guard against non-JSON response from INPI
          let attachments: any;
          try { attachments = await res.json(); } catch { attachments = {}; }
          // P6-12: Guard against non-array actes/bilans
          const actes = Array.isArray(attachments.actes) ? attachments.actes : [];
          const bilans = Array.isArray(attachments.bilans) ? attachments.bilans : [];
          console.log(`[docs] INPI attachments raw keys: ${Object.keys(attachments).join(", ")}`);
          console.log(`[docs] INPI attachments: ${actes.length} actes, ${bilans.length} bilans`);
          if (actes.length > 0) console.log(`[docs] First acte: id=${actes[0].id}, type=${actes[0].typeRdd}, nature=${actes[0].nature}, date=${actes[0].dateDepot}`);
          if (bilans.length > 0) console.log(`[docs] First bilan: id=${bilans[0].id}, type=${bilans[0].typeBilan}, dateCloture=${bilans[0].dateCloture}`);

          // FIX 1: typeRdd is an array of objects in INPI API, not a string
          // FIX 3: Re-auth if token might be expired
          // FIX 4: Normalize source to lowercase "inpi" (matching inpi-documents)
          // Separate statuts from other actes, prioritize statuts
          const statutsActes: any[] = [];
          const autresActes: any[] = [];
          for (const acte of actes) {
            let isStatutActe = false;
            // FIX P4-5: Handle empty typeRdd array + fallback to nomDocument
            if (acte.typeRdd && Array.isArray(acte.typeRdd) && acte.typeRdd.length > 0) {
              isStatutActe = acte.typeRdd.some((t: any) => {
                const ta = String(t.typeActe || "").toLowerCase();
                const dec = String(t.decision || "").toLowerCase();
                return ta.includes("statut") || dec.includes("statut");
              });
            }
            if (!isStatutActe) {
              const fallbackStr = [
                typeof acte.typeRdd === "string" ? acte.typeRdd : "",
                acte.type ?? "", acte.nature ?? "", acte.nomDocument ?? "",
              ].join(" ").toLowerCase();
              isStatutActe = fallbackStr.includes("statut");
            }
            if (isStatutActe) statutsActes.push(acte);
            else autresActes.push(acte);
          }
          console.log(`[docs] Statuts: ${statutsActes.length}, Autres actes: ${autresActes.length}`);
          // FIX P4-44: Sort by date descending — most recent first
          const sortByDate = (a: any, b: any) => (b.dateDepot || b.date || "").localeCompare(a.dateDepot || a.date || "");
          statutsActes.sort(sortByDate);
          autresActes.sort(sortByDate);
          // FIX P4-44: Increase statuts limit to 3
          const actesToProcess = [...statutsActes.slice(0, 3), ...autresActes.slice(0, 3)];

          let currentToken = token;
          // P5-27: Use let so authTime resets after token refresh
          let authTime = Date.now();

          // FIX 32: Parallel downloads with concurrency limit (3 at a time)
          const downloadBatch = async (items: any[], type: "acte" | "bilan") => {
            const results: any[] = [];
            for (let i = 0; i < items.length; i += 3) {
              const batch = items.slice(i, i + 3);
              // Re-auth if token is older than 5 minutes
              if (Date.now() - authTime > 5 * 60 * 1000) {
                console.log("[docs] Token potentiellement expiré, re-authentification...");
                cachedToken = null;
                tokenExpiry = 0;
                const newToken = await getINPIToken();
                if (newToken) { currentToken = newToken; authTime = Date.now(); }
              }
              const batchResults = await Promise.allSettled(
                batch.map(item => processItem(item, type, currentToken))
              );
              for (const r of batchResults) {
                if (r.status === "fulfilled" && r.value) results.push(r.value);
              }
            }
            return results;
          };

          const processItem = async (item: any, type: "acte" | "bilan", tk: string) => {
            if (type === "bilan") {
              const bilanId = item.id;
              const dateCloture = String(item.dateCloture ?? item.date_cloture ?? "");
              const typeBilan = String(item.typeBilan ?? "Comptes annuels");
              const safeDateCloture = String(dateCloture || bilanId).replace(/[^a-zA-Z0-9_-]/g, "");
              const storagePath = `${cleanSiren}/comptes_${safeDateCloture}.pdf`;
              // FIX P4-29: Skip download if file already stored
              if (existingPaths.includes(storagePath)) {
                const { data: signed } = await supabaseClient.storage.from("kyc-documents").createSignedUrl(storagePath, 7 * 24 * 60 * 60);
                if (signed?.signedUrl) {
                  console.log(`[docs] Reusing stored ${storagePath}`);
                  return {
                    type: "Comptes annuels", label: `${typeBilan} — Cloture ${dateCloture}`,
                    url: signed.signedUrl, source: "inpi", available: true, status: "auto",
                    storedInSupabase: true, downloadable: true, dateCloture, storageUrl: signed.signedUrl,
                  };
                }
              }
              const downloadUrl = `${INPI_BASE}/bilans/${bilanId}/download`;
              const publicUrl = await downloadAndStore(supabaseClient, tk, downloadUrl, storagePath);
              return {
                type: "Comptes annuels",
                label: `${typeBilan} — Cloture ${dateCloture}`,
                url: publicUrl ?? `https://data.inpi.fr/entreprises/${cleanSiren}`,
                source: "inpi",
                available: true,
                status: publicUrl ? "auto" : "lien",
                storedInSupabase: !!publicUrl,
                downloadable: !!publicUrl,
                dateCloture,
                storageUrl: publicUrl,
              };
            }
            // acte processing
            return processActe(item, tk);
          };

          const processActe = async (acte: any, tk: string) => {
            const acteId = acte.id;
            // FIX 1: Properly parse typeRdd array
            let acteType = "Acte";
            let nature = "";
            if (acte.typeRdd && Array.isArray(acte.typeRdd) && acte.typeRdd.length > 0) {
              acteType = String(acte.typeRdd[0]?.typeActe || acte.typeRdd[0]?.decision || "Acte");
              nature = acte.typeRdd.map((t: any) => String(t.decision || t.typeActe || "")).filter(Boolean).join(", ");
            } else if (typeof acte.typeRdd === "string") {
              acteType = acte.typeRdd;
              nature = String(acte.nature ?? "");
            } else {
              acteType = String(acte.type ?? "Acte");
              nature = String(acte.nature ?? "");
            }

            const acteDate = String(acte.dateDepot ?? acte.date ?? "");
            const nomDoc = String(acte.nomDocument ?? "");
            const label = nature
              ? `${acteType} — ${nature} — ${acteDate}`
              : `${acteType} — ${nomDoc || "depot"} ${acteDate}`;
            const safeType = acteType.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
            const safeDate = String(acteDate || "").replace(/[^a-zA-Z0-9_-]/g, "");
            // FIX 35: Include acteId in path to avoid storage collisions between different actes
            const storagePath = `${cleanSiren}/${safeType}_${safeDate}_${acteId}.pdf`;

            // FIX P4-29: Skip download if file already stored
            if (existingPaths.includes(storagePath)) {
              const { data: signed } = await supabaseClient.storage.from("kyc-documents").createSignedUrl(storagePath, 7 * 24 * 60 * 60);
              if (signed?.signedUrl) {
                console.log(`[docs] Reusing stored ${storagePath}`);
                const isStatutsCached = (acte.typeRdd && Array.isArray(acte.typeRdd) && acte.typeRdd.length > 0)
                  ? acte.typeRdd.some((t: any) => String(t.typeActe || "").toLowerCase().includes("statut") || String(t.decision || "").toLowerCase().includes("statut"))
                  : acteType.toLowerCase().includes("statut") || nature.toLowerCase().includes("statut") || nomDoc.toLowerCase().includes("statut");
                return {
                  type: isStatutsCached ? "Statuts" : "Actes", label,
                  url: signed.signedUrl, source: "inpi", available: true, status: "auto",
                  storedInSupabase: true, downloadable: true, dateDepot: acteDate, storageUrl: signed.signedUrl,
                };
              }
            }

            const downloadUrl = `${INPI_BASE}/actes/${acteId}/download`;
            // FIX P4-2: Use passed `tk` parameter instead of outer `currentToken` (variable shadowing bug)
            const publicUrl = await downloadAndStore(supabaseClient, tk, downloadUrl, storagePath);

            // FIX 1 + P6-13: Proper statuts detection — check typeRdd array + fallback to acteType/nature/nomDocument
            let isStatuts = false;
            if (acte.typeRdd && Array.isArray(acte.typeRdd) && acte.typeRdd.length > 0) {
              isStatuts = acte.typeRdd.some((t: any) =>
                String(t.typeActe || "").toLowerCase().includes("statut") ||
                String(t.decision || "").toLowerCase().includes("statut"));
            }
            // P6-13: Always also check nomDocument and nature for "statut" keyword (even if typeRdd matched as non-statut)
            if (!isStatuts) {
              isStatuts = acteType.toLowerCase().includes("statut") || nature.toLowerCase().includes("statut") || nomDoc.toLowerCase().includes("statut");
            }
            // FIX P4-47: Also check nomDocument for PV detection
            const isPV = acteType.toLowerCase().includes("pv") || nature.toLowerCase().includes("pv") || nature.toLowerCase().includes("assembl") || nomDoc.toLowerCase().includes("pv") || nomDoc.toLowerCase().includes("assembl");

            return {
              type: isStatuts ? "Statuts" : isPV ? "PV AG" : "Actes",
              label,
              url: publicUrl ?? `https://data.inpi.fr/entreprises/${cleanSiren}`,
              source: "inpi",
              available: true,
              status: publicUrl ? "auto" : "lien",
              storedInSupabase: !!publicUrl,
              downloadable: !!publicUrl,
              dateDepot: acteDate,
              storageUrl: publicUrl,
            };
          };

          // FIX 32: Process actes and bilans in parallel batches
          const acteResults = await downloadBatch(actesToProcess, "acte");
          const bilanResults = await downloadBatch(bilans.slice(0, 3), "bilan");
          documents.push(...acteResults, ...bilanResults);

          if (actes.length > 0 || bilans.length > 0) {
            inpiSuccess = true;
            sources.push("INPI");
          }
        } else {
          console.error(`[docs] INPI attachments: ${res.status}`);
          if (res.status === 401) { cachedToken = null; tokenExpiry = 0; }
        }
      } catch (e) {
        console.error("[docs] INPI attachments error:", (e as Error).message);
      }
    }

    // ====== PHASE 2: Pappers fallback (if INPI returned no documents) ======
    // FIX 24: Don't log Pappers API token
    const pappersKey = Deno.env.get("PAPPERS");
    if (pappersKey) {
      try {
        console.log(`[docs] Pappers lookup for ${cleanSiren}`);
        const res = await fetch(
          `https://api.pappers.fr/v2/entreprise?api_token=${encodeURIComponent(pappersKey)}&siren=${cleanSiren}&extrait_rne=true`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (res.ok) {
          const pappersData = await res.json();
          sources.push("Pappers");

          // Extrait Kbis (Pappers)
          // FIX 7: Normalize type to lowercase "kbis" (matching inpi-documents)
          // FIX 57: Try to download and store Pappers PDFs locally for offline access
          if (pappersData.extrait_immatriculation_url) {
            let kbisUrl = pappersData.extrait_immatriculation_url;
            try {
              const pRes = await fetch(kbisUrl, { signal: AbortSignal.timeout(10000), redirect: "follow" });
              if (pRes.ok) {
                const buf = await pRes.arrayBuffer();
                const header = String.fromCharCode(...new Uint8Array(buf.slice(0, 5)));
                if (header.startsWith("%PDF") && buf.byteLength > 100) {
                  const path = `${cleanSiren}/kbis_pappers.pdf`;
                  await supabaseClient.storage.from("kyc-documents").upload(path, new Uint8Array(buf), { contentType: "application/pdf", upsert: true });
                  const { data: signed } = await supabaseClient.storage.from("kyc-documents").createSignedUrl(path, 7 * 24 * 60 * 60);
                  if (signed?.signedUrl) kbisUrl = signed.signedUrl;
                  console.log("[docs] Pappers KBIS stored locally");
                }
              }
            } catch { /* Non-critical: fall back to direct Pappers URL */ }
            documents.push({
              type: "kbis",
              label: "Extrait Kbis (Pappers)",
              url: kbisUrl,
              source: "pappers",
              available: true,
              status: "auto",
              downloadable: true,
              storedInSupabase: kbisUrl !== pappersData.extrait_immatriculation_url,
              storageUrl: kbisUrl !== pappersData.extrait_immatriculation_url ? kbisUrl : null,
            });
          }

          // P6-14: Extrait RBE — store locally like KBIS for offline access
          if (pappersData.extrait_rbe_url) {
            let rbeUrl = pappersData.extrait_rbe_url;
            try {
              const rbeRes = await fetch(rbeUrl, { signal: AbortSignal.timeout(10000), redirect: "follow" });
              if (rbeRes.ok) {
                const rbeBuf = await rbeRes.arrayBuffer();
                const rbeHeader = String.fromCharCode(...new Uint8Array(rbeBuf.slice(0, 5)));
                if (rbeHeader.startsWith("%PDF") && rbeBuf.byteLength > 100) {
                  const rbePath = `${cleanSiren}/rbe_pappers.pdf`;
                  await supabaseClient.storage.from("kyc-documents").upload(rbePath, new Uint8Array(rbeBuf), { contentType: "application/pdf", upsert: true });
                  const { data: rbeSigned } = await supabaseClient.storage.from("kyc-documents").createSignedUrl(rbePath, 7 * 24 * 60 * 60);
                  if (rbeSigned?.signedUrl) rbeUrl = rbeSigned.signedUrl;
                  console.log("[docs] Pappers RBE stored locally");
                }
              }
            } catch { /* Non-critical */ }
            documents.push({
              type: "Extrait RBE",
              label: "Extrait RBE (Pappers)",
              url: rbeUrl,
              source: "pappers",
              available: true,
              status: "auto",
              downloadable: true,
              storedInSupabase: rbeUrl !== pappersData.extrait_rbe_url,
              storageUrl: rbeUrl !== pappersData.extrait_rbe_url ? rbeUrl : null,
            });
          }

          // FIX P4-6: Add Pappers complementary docs even when INPI partially succeeded
          // Check which types INPI already provided (stored PDFs only)
          const inpiStoredTypes = new Set(
            documents.filter(d => d.storedInSupabase && d.source === "inpi").map(d => d.type)
          );

          // Add Pappers Statuts link if INPI didn't store any Statuts PDF
          if (!inpiStoredTypes.has("Statuts") && pappersData.derniers_statuts?.date_depot) {
            documents.push({
              type: "Statuts",
              label: `Statuts — ${pappersData.derniers_statuts.date_depot}`,
              url: `https://www.pappers.fr/entreprise/${cleanSiren}#documents`,
              source: "pappers",
              available: true,
              status: "lien",
              downloadable: false,
              storageUrl: null,
            });
          }

          // P6-15: Add Pappers actes if INPI returned none — detect Statuts vs Actes
          if (!inpiSuccess && pappersData.actes?.length > 0) {
            for (const acte of pappersData.actes.slice(0, 3)) {
              const acteTypeStr = (acte.type ?? "").toLowerCase();
              const isStatut = acteTypeStr.includes("statut");
              // P6-16: Don't add Pappers Statuts if we already have one from derniers_statuts
              if (isStatut && documents.some(d => d.type === "Statuts" && d.source === "pappers")) continue;
              documents.push({
                type: isStatut ? "Statuts" : "Actes",
                label: `${isStatut ? "Statuts" : "Acte"} — ${acte.type ?? "Dernier acte"} — ${acte.date_depot ?? ""}`,
                url: `https://www.pappers.fr/entreprise/${cleanSiren}#documents`,
                source: "pappers",
                available: true,
                status: "lien",
                downloadable: false,
                storageUrl: null,
              });
            }
          }

          // Add Pappers comptes if INPI didn't store any
          if (!inpiStoredTypes.has("Comptes annuels")) {
            const comptesArray = pappersData.comptes ?? (pappersData.derniers_comptes ? [pappersData.derniers_comptes] : []);
            if (comptesArray.length > 0) {
              documents.push({
                type: "Comptes annuels",
                label: `Comptes annuels (${comptesArray.filter(Boolean).length} exercice(s))`,
                url: `https://www.pappers.fr/entreprise/${cleanSiren}#finances`,
                source: "pappers",
                available: true,
                status: "lien",
                downloadable: false,
                storageUrl: null,
              });
            }
          }

          // BE from Pappers (always useful)
          if (pappersData.beneficiaires_effectifs?.length > 0) {
            beneficiaires = pappersData.beneficiaires_effectifs.map((be: any) => ({
              nom: be.nom ?? "",
              prenom: be.prenom ?? "",
              date_naissance: be.date_de_naissance_formatee ?? be.date_de_naissance ?? "",
              nationalite: be.nationalite ?? "",
              pourcentage_parts: be.pourcentage_parts ?? 0,
              pourcentage_votes: be.pourcentage_votes ?? 0,
            }));
          }
        }
      } catch {
        console.log("[docs] Pappers unavailable");
      }
    }

    // Web links removed — step 6 shows only real PDFs + manual upload zones

    // FIX 51 + P6-17: Required docs checklist — case-insensitive matching
    const requiredDocs = ["KBIS", "Statuts", "CNI", "RIB"];
    const foundTypes = documents.filter((d: any) => d.status === "auto" || d.storedInSupabase || d.downloadable).map((d: any) => d.type);
    // P6-17: Also match "Extrait RBE" and "Extrait RNE" as KBIS equivalents
    const missing = requiredDocs.filter(r => !foundTypes.some(f => {
      if (r === "KBIS") return f.toUpperCase().includes("KBIS") || f.toUpperCase().includes("EXTRAIT");
      return f.toUpperCase().includes(r.toUpperCase());
    }));

    // Add placeholder entries for missing required docs
    if (!documents.some(d => d.type === "CNI")) {
      documents.push({
        type: "CNI",
        label: "CNI du dirigeant",
        url: null,
        source: null,
        available: false,
        status: "manquant",
        downloadable: false,
        storageUrl: null,
      });
    }
    if (!documents.some(d => d.type === "RIB")) {
      documents.push({
        type: "RIB",
        label: "RIB / IBAN",
        url: null,
        source: null,
        available: false,
        status: "manquant",
        downloadable: false,
        storageUrl: null,
      });
    }

    const autoRecovered = documents.filter((d: any) => d.status === "auto" || d.downloadable).length;

    console.log(`[docs] === Done: ${documents.length} docs, ${autoRecovered} auto, sources: ${sources.join(",")} ===`);

    return new Response(JSON.stringify({
      documents,
      beneficiaires_effectifs: beneficiaires,
      total: documents.length,
      autoRecovered,
      missing,
      sources,
      status: "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // FIX 27: Don't leak internal error details to client
    console.error("[docs] Unhandled error:", (error as Error).message);
    return new Response(JSON.stringify({
      error: "Service de documents temporairement indisponible",
      documents: [],
      beneficiaires_effectifs: [],
      missing: ["KBIS", "Statuts", "CNI", "RIB"],
      status: "unavailable",
    }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
