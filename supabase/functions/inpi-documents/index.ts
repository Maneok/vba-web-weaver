import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const INPI_BASE = "https://registre-national-entreprises.inpi.fr/api";

async function inpiLogin(): Promise<string | null> {
  const username = Deno.env.get("INPI_USERNAME");
  const password = Deno.env.get("INPI_PASSWORD");
  if (!username || !password) return null;

  try {
    const res = await fetch(`${INPI_BASE}/sso/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch {
    return null;
  }
}

async function getCompanyData(token: string, siren: string): Promise<any> {
  try {
    const res = await fetch(`${INPI_BASE}/companies/${siren}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getAttachments(token: string, siren: string): Promise<any> {
  try {
    const res = await fetch(`${INPI_BASE}/companies/${siren}/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
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
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;

    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(storagePath, uint8, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("Storage upload error:", error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("kyc-documents")
      .getPublicUrl(storagePath);

    return urlData?.publicUrl ?? null;
  } catch (e) {
    console.error("Download error:", e);
    return null;
  }
}

function parseFinancials(bilansSaisis: any[]): any {
  if (!bilansSaisis || bilansSaisis.length === 0) return null;

  const latest = bilansSaisis[0];
  const data = latest.data ?? latest.donnees ?? {};
  const pages = data.pages ?? data;

  const getValue = (code: string): number | null => {
    // Search through all pages for the code
    for (const key of Object.keys(pages)) {
      const page = pages[key];
      if (typeof page !== "object") continue;
      for (const row of Object.values(page as Record<string, any>)) {
        if (row?.code === code || key === code) {
          return row?.m1 ?? row?.valeur ?? row?.montant ?? null;
        }
      }
    }
    // Try flat structure
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
      return new Response(JSON.stringify({ error: "siren requis", status: "error" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanSiren = (siren as string).replace(/\s/g, "");

    // Step A: INPI Authentication
    const token = await inpiLogin();
    if (!token) {
      return new Response(JSON.stringify({
        documents: [],
        companyData: null,
        financials: null,
        status: "unavailable",
        error: "INPI authentication failed — check INPI_USERNAME/INPI_PASSWORD secrets",
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

      // Step D: Download actes
      for (const acte of actes.slice(0, 5)) {
        const acteId = acte.id;
        const acteType = acte.typeRdd ?? acte.type ?? "Acte";
        const acteDate = acte.dateDepot ?? acte.date ?? "";
        const storagePath = `${cleanSiren}/${acteType.replace(/\s/g, "_")}_${acteDate || acteId}.pdf`;

        const downloadUrl = `${INPI_BASE}/actes/${acteId}/download`;
        const publicUrl = await downloadAndStore(supabase, token, downloadUrl, storagePath);

        documents.push({
          type: acteType.includes("statut") ? "Statuts" : "Actes",
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
    return new Response(JSON.stringify({
      error: (error as Error).message,
      documents: [],
      companyData: null,
      financials: null,
      status: "unavailable",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
