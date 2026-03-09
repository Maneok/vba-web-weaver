import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

const INPI_BASE = "https://registre-national-entreprises.inpi.fr/api";

// ====== INPI Auth with token cache ======
let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getINPIToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
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
async function downloadAndStore(
  supabaseClient: any,
  token: string,
  url: string,
  storagePath: string,
): Promise<string | null> {
  try {
    console.log(`[docs] Downloading ${url}`);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[docs] Download failed: ${res.status} ${res.statusText} for ${url} — ${errBody.substring(0, 200)}`);
      if (res.status === 401) { cachedToken = null; tokenExpiry = 0; }
      return null;
    }

    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    console.log(`[docs] Downloaded ${uint8.length} bytes → ${storagePath}`);

    const { error } = await supabaseClient.storage
      .from("kyc-documents")
      .upload(storagePath, uint8, {
        contentType: blob.type || "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("[docs] Storage upload error:", error.message);
      return null;
    }

    const { data: urlData } = supabaseClient.storage
      .from("kyc-documents")
      .getPublicUrl(storagePath);

    console.log(`[docs] Stored OK: ${storagePath}`);
    return urlData?.publicUrl ?? null;
  } catch (e) {
    console.error("[docs] Download/store error:", (e as Error).message);
    return null;
  }
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

    const cleanSiren = (siren as string).replace(/\s/g, "");
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
        await supabaseClient.storage.createBucket("kyc-documents", { public: true });
        console.log("[docs] Bucket kyc-documents created");
      }
    } catch (e) {
      console.error("[docs] Bucket check error:", (e as Error).message);
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
          const attachments = await res.json();
          const actes = attachments.actes ?? [];
          const bilans = attachments.bilans ?? [];
          console.log(`[docs] INPI attachments raw keys: ${Object.keys(attachments).join(", ")}`);
          console.log(`[docs] INPI attachments: ${actes.length} actes, ${bilans.length} bilans`);
          if (actes.length > 0) console.log(`[docs] First acte: id=${actes[0].id}, type=${actes[0].typeRdd}, nature=${actes[0].nature}, date=${actes[0].dateDepot}`);
          if (bilans.length > 0) console.log(`[docs] First bilan: id=${bilans[0].id}, type=${bilans[0].typeBilan}, dateCloture=${bilans[0].dateCloture}`);

          // Process actes (statuts, PV, decisions)
          for (const acte of actes.slice(0, 5)) {
            const acteId = acte.id;
            const acteType = String(acte.typeRdd ?? acte.type ?? "Acte");
            const acteDate = String(acte.dateDepot ?? acte.date ?? "");
            const nature = String(acte.nature ?? "");
            const nomDoc = String(acte.nomDocument ?? "");
            const label = nature
              ? `${acteType} — ${nature} — ${acteDate}`
              : `${acteType} — ${nomDoc || "depot"} ${acteDate}`;
            const storagePath = `${cleanSiren}/${acteType.replace(/\s/g, "_")}_${acteDate || acteId}.pdf`;

            const downloadUrl = `${INPI_BASE}/actes/${acteId}/download`;
            const publicUrl = await downloadAndStore(supabaseClient, token, downloadUrl, storagePath);

            const isStatuts = acteType.toLowerCase().includes("statut") || nature.toLowerCase().includes("statut") || nomDoc.toLowerCase().includes("statut");
            const isPV = acteType.toLowerCase().includes("pv") || nature.toLowerCase().includes("pv") || nature.toLowerCase().includes("assembl");

            documents.push({
              type: isStatuts ? "Statuts" : isPV ? "PV AG" : "Actes",
              label,
              url: publicUrl ?? `https://data.inpi.fr/entreprises/${cleanSiren}`,
              source: "INPI",
              available: true,
              status: publicUrl ? "auto" : "lien",
              storedInSupabase: !!publicUrl,
              downloadable: !!publicUrl,
              dateDepot: acteDate,
              storageUrl: publicUrl,
            });
          }

          // Process bilans (comptes annuels)
          for (const bilan of bilans.slice(0, 3)) {
            const bilanId = bilan.id;
            const dateCloture = String(bilan.dateCloture ?? bilan.date_cloture ?? "");
            const typeBilan = String(bilan.typeBilan ?? "Comptes annuels");
            const storagePath = `${cleanSiren}/comptes_${dateCloture || bilanId}.pdf`;

            const downloadUrl = `${INPI_BASE}/bilans/${bilanId}/download`;
            const publicUrl = await downloadAndStore(supabaseClient, token, downloadUrl, storagePath);

            documents.push({
              type: "Comptes annuels",
              label: `${typeBilan} — Cloture ${dateCloture}`,
              url: publicUrl ?? `https://data.inpi.fr/entreprises/${cleanSiren}`,
              source: "INPI",
              available: true,
              status: publicUrl ? "auto" : "lien",
              storedInSupabase: !!publicUrl,
              downloadable: !!publicUrl,
              dateCloture,
              storageUrl: publicUrl,
            });
          }

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
    const pappersKey = Deno.env.get("PAPPERS");
    if (pappersKey) {
      try {
        const res = await fetch(
          `https://api.pappers.fr/v2/entreprise?api_token=${pappersKey}&siren=${cleanSiren}&extrait_rne=true`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (res.ok) {
          const pappersData = await res.json();
          sources.push("Pappers");

          // Extrait Kbis (Pappers)
          if (pappersData.extrait_immatriculation_url) {
            documents.push({
              type: "KBIS",
              label: "Extrait Kbis (Pappers)",
              url: pappersData.extrait_immatriculation_url,
              source: "Pappers",
              available: true,
              status: "auto",
              downloadable: true,
              storageUrl: null,
            });
          }

          // Extrait RBE
          if (pappersData.extrait_rbe_url) {
            documents.push({
              type: "Extrait RBE",
              label: "Extrait RBE (Pappers)",
              url: pappersData.extrait_rbe_url,
              source: "Pappers",
              available: true,
              status: "auto",
              downloadable: true,
              storageUrl: null,
            });
          }

          // Only add Pappers document links if INPI didn't return documents
          if (!inpiSuccess) {
            if (pappersData.derniers_statuts?.date_depot) {
              documents.push({
                type: "Statuts",
                label: `Statuts — ${pappersData.derniers_statuts.date_depot}`,
                url: `https://www.pappers.fr/entreprise/${cleanSiren}#documents`,
                source: "Pappers",
                available: true,
                status: "lien",
                downloadable: false,
                storageUrl: null,
              });
            }

            if (pappersData.actes?.length > 0) {
              const acte = pappersData.actes[0];
              documents.push({
                type: "Actes",
                label: `Acte — ${acte.type ?? "Dernier acte"} — ${acte.date_depot ?? ""}`,
                url: `https://www.pappers.fr/entreprise/${cleanSiren}#documents`,
                source: "Pappers",
                available: true,
                status: "lien",
                downloadable: false,
                storageUrl: null,
              });
            }

            const comptesArray = pappersData.comptes ?? (pappersData.derniers_comptes ? [pappersData.derniers_comptes] : []);
            if (comptesArray.length > 0) {
              documents.push({
                type: "Comptes annuels",
                label: `Comptes annuels (${comptesArray.filter(Boolean).length} exercice(s))`,
                url: `https://www.pappers.fr/entreprise/${cleanSiren}#finances`,
                source: "Pappers",
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

    // ====== Required docs checklist ======
    const requiredDocs = ["KBIS", "Statuts", "CNI", "RIB"];
    const foundTypes = documents.filter((d: any) => d.status === "auto" && d.downloadable).map((d: any) => d.type);
    const missing = requiredDocs.filter(r => !foundTypes.some(f => f.toUpperCase().includes(r.toUpperCase())));

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
    return new Response(JSON.stringify({
      error: (error as Error).message,
      documents: [],
      beneficiaires_effectifs: [],
      missing: ["KBIS", "Statuts", "CNI", "RIB"],
      status: "unavailable",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
