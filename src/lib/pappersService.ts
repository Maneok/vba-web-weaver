/**
 * BLOC 1 — Auto-KYC via Pappers API
 * In production, this would go through a Supabase Edge Function to hide the API key.
 * For now, we implement the client-side logic with a configurable endpoint.
 */

export interface PappersEntreprise {
  siren: string;
  denomination: string;
  forme_juridique: string;
  adresse_ligne_1: string;
  code_postal: string;
  ville: string;
  code_naf: string;
  libelle_code_naf: string;
  capital: number;
  dirigeants: { nom: string; prenom: string; qualite: string }[];
  date_creation: string;
  effectifs: string;
  tranche_effectif: string;
  beneficiaires_effectifs: { nom: string; prenom: string; pourcentage_parts: number }[];
  documents?: { type: string; date: string; url: string }[];
}

export interface PappersResult {
  success: boolean;
  data?: PappersEntreprise;
  error?: string;
}

// Simulated Pappers API for demo (would be a Supabase Edge Function in production)
const DEMO_DATA: Record<string, PappersEntreprise> = {
  "412345678": {
    siren: "412345678",
    denomination: "BOULANGERIE MARTIN",
    forme_juridique: "Entreprise individuelle",
    adresse_ligne_1: "14 RUE DU FOUR",
    code_postal: "13001",
    ville: "MARSEILLE",
    code_naf: "56.10A",
    libelle_code_naf: "Restauration traditionnelle",
    capital: 0,
    dirigeants: [{ nom: "MARTIN", prenom: "Jean-Pierre", qualite: "Entrepreneur individuel" }],
    date_creation: "2005-03-15",
    effectifs: "3 à 5 salariés",
    tranche_effectif: "3 À 5 SALARIÉS",
    beneficiaires_effectifs: [{ nom: "MARTIN", prenom: "Jean-Pierre", pourcentage_parts: 100 }],
  },
  "498765432": {
    siren: "498765432",
    denomination: "CABINET MEDICAL DR LEFEBVRE",
    forme_juridique: "SCP",
    adresse_ligne_1: "8 AVENUE JEAN JAURÈS",
    code_postal: "69003",
    ville: "LYON",
    code_naf: "86.21Z",
    libelle_code_naf: "Médecine générale",
    capital: 80000,
    dirigeants: [{ nom: "LEFEBVRE", prenom: "Sophie", qualite: "Gérante" }],
    date_creation: "2010-09-01",
    effectifs: "1 ou 2 salariés",
    tranche_effectif: "1 OU 2 SALARIÉS",
    beneficiaires_effectifs: [{ nom: "LEFEBVRE", prenom: "Sophie", pourcentage_parts: 100 }],
  },
};

/**
 * Fetch company data from Pappers API (via Edge Function proxy in production)
 */
export async function fetchPappersData(siren: string): Promise<PappersResult> {
  const cleanSiren = siren.replace(/\s/g, "");
  if (cleanSiren.length !== 9) {
    return { success: false, error: "Le SIREN doit contenir 9 chiffres" };
  }

  // Check if we have the Supabase Edge Function URL configured
  const edgeFunctionUrl = import.meta.env.VITE_PAPPERS_EDGE_FUNCTION_URL;

  if (edgeFunctionUrl) {
    try {
      const res = await fetch(`${edgeFunctionUrl}?siren=${cleanSiren}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: `Erreur API Pappers: ${err.message}` };
    }
  }

  // Fallback: demo mode with simulated data
  await new Promise(r => setTimeout(r, 800)); // Simulate network delay

  if (DEMO_DATA[cleanSiren]) {
    return { success: true, data: DEMO_DATA[cleanSiren] };
  }

  // Generate plausible data for any SIREN in demo mode
  return {
    success: true,
    data: {
      siren: cleanSiren,
      denomination: `SOCIÉTÉ ${cleanSiren.slice(0, 3)}`,
      forme_juridique: "SARL",
      adresse_ligne_1: "1 RUE DE LA PAIX",
      code_postal: "75001",
      ville: "PARIS",
      code_naf: "70.22Z",
      libelle_code_naf: "Conseil pour les affaires",
      capital: 10000,
      dirigeants: [{ nom: "DEMO", prenom: "Utilisateur", qualite: "Gérant" }],
      date_creation: "2020-01-01",
      effectifs: "1 ou 2 salariés",
      tranche_effectif: "1 OU 2 SALARIÉS",
      beneficiaires_effectifs: [{ nom: "DEMO", prenom: "Utilisateur", pourcentage_parts: 100 }],
    },
  };
}

/**
 * Check if a person is a PPE (Personne Politiquement Exposée)
 * In production: cross-reference with HATVP public list via Edge Function
 */
export async function checkPPE(nom: string, prenom: string): Promise<{ isPPE: boolean; details?: string }> {
  // Known PPE list for demo (in production, query HATVP API)
  const KNOWN_PPE = [
    { nom: "MOREL", prenom: "François", details: "Ancien directeur de cabinet ministériel" },
    { nom: "KONATÉ", prenom: "Ibrahim", details: "Fonctionnaire international ONU" },
  ];

  await new Promise(r => setTimeout(r, 300));

  const match = KNOWN_PPE.find(p =>
    p.nom.toUpperCase() === nom.toUpperCase() &&
    p.prenom.toUpperCase() === prenom.toUpperCase()
  );

  return match ? { isPPE: true, details: match.details } : { isPPE: false };
}

/**
 * Check against DG Trésor gel d'avoirs registry
 * In production: query https://gels-avoirs.dgtresor.gouv.fr via Edge Function
 */
export async function checkGelAvoirs(siren: string, raisonSociale: string): Promise<"CLEAN" | "FLAGGED" | "UNKNOWN"> {
  await new Promise(r => setTimeout(r, 300));
  // Demo: all clean
  return "CLEAN";
}

/**
 * Map Pappers forme juridique to our FormeJuridique type
 */
export function mapFormeJuridique(pappersForm: string): string {
  const f = pappersForm.toUpperCase();
  if (f.includes("INDIVIDUEL") || f.includes("EI")) return "ENTREPRISE INDIVIDUELLE";
  if (f.includes("EURL")) return "EURL";
  if (f.includes("SARL")) return "SARL";
  if (f.includes("SELAS")) return "SELAS";
  if (f.includes("SAS")) return "SAS";
  if (f.includes("SCI")) return "SCI";
  if (f.includes("SCP")) return "SCP";
  if (f.includes("EARL")) return "EARL";
  if (f.includes("SA ") || f === "SA") return "SA";
  if (f.includes("ASSOCIATION")) return "ASSOCIATION";
  return pappersForm;
}

/**
 * Map Pappers effectif to our effectif format
 */
export function mapEffectif(effectif: string): string {
  if (!effectif) return "0 SALARIÉ";
  const e = effectif.toUpperCase();
  if (e.includes("0") && !e.includes("10") && !e.includes("50")) return "0 SALARIÉ";
  if (e.includes("1") && (e.includes("2") || e.includes("OU"))) return "1 OU 2 SALARIÉS";
  if (e.includes("3") || e.includes("5")) return "3 À 5 SALARIÉS";
  if (e.includes("6") || e.includes("10")) return "6 À 10 SALARIÉS";
  if (e.includes("11") || e.includes("50")) return "11 À 50 SALARIÉS";
  if (e.includes("PLUS") || e.includes("51") || parseInt(effectif) > 50) return "PLUS DE 50";
  return effectif;
}
