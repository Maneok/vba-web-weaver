import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const INPI_BASE = "https://registre-national-entreprises.inpi.fr/api";

async function inpiLogin(): Promise<{ token: string | null; error: string | null }> {
  const username = Deno.env.get("INPI_USERNAME");
  const password = Deno.env.get("INPI_PASSWORD");
  if (!username || !password) {
    return { token: null, error: "INPI_USERNAME ou INPI_PASSWORD manquant dans les secrets Supabase" };
  }

  try {
    console.log("[INPI] Authentification en cours...");
    const res = await fetch(`${INPI_BASE}/sso/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[INPI] Auth failed: ${res.status} ${res.statusText} — ${body}`);
      if (res.status === 403 && body.includes("connection_type_not_allowed")) {
        return { token: null, error: "Compte INPI sans acces API. Demandez l'acces API sur data.inpi.fr" };
      }
      return { token: null, error: `INPI auth failed (${res.status}): ${body || res.statusText}` };
    }

    const data = await res.json();
    const token = data.token ?? null;
    if (token) {
      console.log("[INPI] Auth OK — token obtenu");
    } else {
      console.error("[INPI] Auth response sans token:", JSON.stringify(data));
      return { token: null, error: "Reponse INPI sans champ token" };
    }
    return { token, error: null };
  } catch (e) {
    const msg = (e as Error).message || String(e);
    console.error("[INPI] Auth exception:", msg);
    return { token: null, error: `INPI auth exception: ${msg}` };
  }
}

async function getCompanyData(token: string, siren: string): Promise<any> {
  try {
    console.log(`[INPI] GET /companies/${siren}`);
    const res = await fetch(`${INPI_BASE}/companies/${siren}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[INPI] companies/${siren}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log(`[INPI] Company data OK for ${siren}`);
    return data;
  } catch (e) {
    console.error("[INPI] getCompanyData error:", (e as Error).message);
    return null;
  }
}

async function getAttachments(token: string, siren: string): Promise<any> {
  try {
    console.log(`[INPI] GET /companies/${siren}/attachments`);
    const res = await fetch(`${INPI_BASE}/companies/${siren}/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`[INPI] attachments/${siren}: ${res.status}`);
      return null;
    }
    const data = await res.json();
    console.log(`[INPI] Attachments OK — actes: ${(data.actes ?? []).length}, bilans: ${(data.bilans ?? []).length}`);
    return data;
  } catch (e) {
    console.error("[INPI] getAttachments error:", (e as Error).message);
    return null;
  }
}

async function downloadAndStore(
  supabase: any,
  token: string,
  url: string,
  storagePath: string,
): Promise<string | null> {
  try {
    console.log(`[INPI] Downloading ${url}`);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(`[INPI] Download failed: ${res.status} for ${url}`);
      return null;
    }

    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    console.log(`[INPI] Downloaded ${uint8.length} bytes, uploading to ${storagePath}`);

    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(storagePath, uint8, {
        contentType: blob.type || "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("[INPI] Storage upload error:", error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("kyc-documents")
      .getPublicUrl(storagePath);

    console.log(`[INPI] Stored OK: ${storagePath}`);
    return urlData?.publicUrl ?? null;
  } catch (e) {
    console.error("[INPI] Download/store error:", (e as Error).message);
    return null;
  }
}

function parseFinancials(bilansSaisis: any[]): any {
  if (!bilansSaisis || bilansSaisis.length === 0) return null;

  const latest = bilansSaisis[0];
  const data = latest.data ?? latest.donnees ?? {};
  const pages = data.pages ?? data;

  const getValue = (code: string): number | null => {
    for (const key of Object.keys(pages)) {
      const page = pages[key];
      if (typeof page !== "object") continue;
      for (const row of Object.values(page as Record<string, any>)) {
        if (row?.code === code || key === code) {
          return row?.m1 ?? row?.valeur ?? row?.montant ?? null;
        }
      }
    }
    if (data[code]) return data[code]?.m1 ?? data[code]?.m3 ?? null;
    return null;
  };

  return {
    dateCloture: latest.dateCloture ?? latest.date_cloture ?? "",
    chiffreAffaires: getValue("FJ"),
    resultat: getValue("HN"),
    capital: getValue("DA"),
    totalBilan: getValue("EE"),
    effectif: getValue("YP"),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { siren } = await req.json();
    if (!siren) {
      return new Response(JSON.stringify({ error: "siren requis", status: "error", documents: [], companyData: null, financials: null, totalDocuments: 0, storedCount: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSiren = (siren as string).replace(/\s/g, "");
    console.log(`[INPI] === Start for SIREN ${cleanSiren} ===`);

    // Step A: INPI Authentication
    const { token, error: authError } = await inpiLogin();
    if (!token) {
      return new Response(JSON.stringify({
        documents: [],
        companyData: null,
        financials: null,
        totalDocuments: 0,
        storedCount: 0,
        status: "partial",
        error: authError || "INPI authentication failed",
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client for storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Ensure bucket exists
    try {
      await supabase.storage.createBucket("kyc-documents", { public: true });
    } catch {
      // Bucket may already exist
    }

    // Step B: Get company data
    const companyRaw = await getCompanyData(token, cleanSiren);
    let companyData: any = null;

    if (companyRaw) {
      const pm = companyRaw.personneMorale ?? companyRaw.formality?.content?.personneMorale ?? {};
      const identite = pm.identite ?? {};
      const entreprise = identite.entreprise ?? {};
      const description = identite.description ?? {};
      const adresseEntreprise = pm.adresseEntreprise ?? {};
      const adresse = adresseEntreprise.adresse ?? {};
      const pouvoirs = pm.composition?.pouvoirs ?? [];

      const dirigeants = pouvoirs
        .filter((p: any) => !p.beneficiaireEffectif)
        .map((p: any) => ({
          nom: p.individu?.nom ?? p.nom ?? "",
          prenom: p.individu?.prenom ?? p.prenom ?? "",
          qualite: p.roleEnEntreprise ?? p.qualite ?? "",
          dateNaissance: p.individu?.dateDeNaissance ?? "",
        }));

      const beneficiaires = pouvoirs
        .filter((p: any) => p.beneficiaireEffectif === true)
        .map((p: any) => ({
          nom: p.individu?.nom ?? p.nom ?? "",
          prenom: p.individu?.prenom ?? p.prenom ?? "",
          dateNaissance: p.individu?.dateDeNaissance ?? "",
          nationalite: p.individu?.nationalite ?? "",
          pourcentageParts: p.pourcentageDetentionCapital ?? 0,
        }));

      companyData = {
        denomination: entreprise.denomination ?? "",
        formeJuridique: entreprise.formeJuridique ?? "",
        capital: description.montantCapital ?? 0,
        objetSocial: description.objet ?? "",
        duree: description.duree ?? "",
        dateClotureExercice: description.dateClotureExerciceSocial ?? "",
        adresse: {
          numVoie: adresse.numVoie ?? "",
          typeVoie: adresse.typeVoie ?? "",
          voie: adresse.voie ?? "",
          codePostal: adresse.codePostal ?? "",
          commune: adresse.commune ?? "",
        },
        dirigeants,
        beneficiaires,
        historique: (companyRaw.content?.historique ?? []).slice(0, 20),
      };
    }

    // Step C: Get attachments (actes + bilans)
    const attachments = await getAttachments(token, cleanSiren);
    const documents: any[] = [];
    let financials: any = null;

    if (attachments) {
      const actes = attachments.actes ?? [];
      const bilans = attachments.bilans ?? [];
      const bilansSaisis = attachments.bilansSaisis ?? [];

      console.log(`[INPI] Found ${actes.length} actes, ${bilans.length} bilans, ${bilansSaisis.length} bilansSaisis`);

      // Step D: Download actes
      for (const acte of actes.slice(0, 5)) {
        const acteId = acte.id;
        const acteType = acte.typeRdd ?? acte.type ?? "Acte";
        const acteDate = acte.dateDepot ?? acte.date ?? "";
        const storagePath = `${cleanSiren}/${acteType.replace(/\s/g, "_")}_${acteDate || acteId}.pdf`;

        const downloadUrl = `${INPI_BASE}/actes/${acteId}/download`;
        const publicUrl = await downloadAndStore(supabase, token, downloadUrl, storagePath);

        documents.push({
          type: acteType.toLowerCase().includes("statut") ? "Statuts" : "Actes",
          label: `${acteType} — ${acteDate}`,
          url: publicUrl ?? downloadUrl,
          source: "inpi",
          available: true,
          status: publicUrl ? "auto" : "lien",
          storedInSupabase: !!publicUrl,
        });
      }

      // Download bilans
      for (const bilan of bilans.slice(0, 3)) {
        const bilanId = bilan.id;
        const dateCloture = bilan.dateCloture ?? bilan.date_cloture ?? "";
        const typeBilan = bilan.typeBilan ?? "Comptes annuels";
        const storagePath = `${cleanSiren}/comptes_${dateCloture || bilanId}.pdf`;

        const downloadUrl = `${INPI_BASE}/bilans/${bilanId}/download`;
        const publicUrl = await downloadAndStore(supabase, token, downloadUrl, storagePath);

        documents.push({
          type: "Comptes annuels",
          label: `${typeBilan} — Cloture ${dateCloture}`,
          url: publicUrl ?? downloadUrl,
          source: "inpi",
          available: true,
          status: publicUrl ? "auto" : "lien",
          storedInSupabase: !!publicUrl,
        });
      }

      // Step F: Parse financial data from bilansSaisis
      financials = parseFinancials(bilansSaisis);
    }

    console.log(`[INPI] === Done: ${documents.length} docs, ${documents.filter((d: any) => d.storedInSupabase).length} stored ===`);

    return new Response(JSON.stringify({
      documents,
      companyData,
      financials,
      totalDocuments: documents.length,
      storedCount: documents.filter((d: any) => d.storedInSupabase).length,
      status: "ok",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[INPI] Unhandled error:", (error as Error).message);
    return new Response(JSON.stringify({
      error: (error as Error).message,
      documents: [],
      companyData: null,
      financials: null,
      totalDocuments: 0,
      storedCount: 0,
      status: "partial",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
