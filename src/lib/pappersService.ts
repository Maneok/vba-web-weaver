import { supabase } from "@/integrations/supabase/client";

export interface PappersResult {
  siren: string;
  raison_sociale: string;
  forme_juridique: string;
  forme_juridique_raw: string;
  adresse: string;
  code_postal: string;
  ville: string;
  ape: string;
  libelle_ape: string;
  capital: number;
  date_creation: string;
  effectif: string;
  dirigeant: string;
  beneficiaires_effectifs: string;
  representants: Array<{ nom: string; qualite: string }>;
  documents_disponibles: Array<{ type: string; date: string; url: string }>;
  document_urls: Record<string, string>;
}

export interface PappersResponse {
  results: PappersResult[];
  message?: string;
  error?: string;
}

export type SearchMode = "siren" | "nom" | "dirigeant";

export async function searchPappers(
  mode: SearchMode,
  query: string,
  downloadDocs = false
): Promise<PappersResponse> {
  const { data, error } = await supabase.functions.invoke("pappers-lookup", {
    body: { mode, query, download_docs: downloadDocs },
  });

  if (error) {
    return { results: [], error: error.message };
  }

  return data as PappersResponse;
}
