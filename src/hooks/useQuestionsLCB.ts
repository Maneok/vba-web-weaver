import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface QuestionLCBFromDB {
  id: string;
  code: string;
  libelle: string;
  description: string | null;
  categorie: string | null;
  categories: string[];
  ponderation: number;
  reponse_risquee: string | null;
  ordre: number;
}

// Fallback hardcoded (les 13 questions actuelles) si la DB ne retourne rien
const FALLBACK_QUESTIONS: QuestionLCBFromDB[] = [
  { id: "ppe", code: "ppe", libelle: "Le client ou son représentant est-il une Personne Politiquement Exposée (PPE) ?", description: "Art. L.561-10 II CMF", categorie: "identite", categories: ["identite"], ponderation: 100, reponse_risquee: "OUI", ordre: 1 },
  { id: "paysRisque", code: "paysRisque", libelle: "Le client est-il lié à un pays à risque (liste GAFI / UE) ?", description: "Art. L.561-10 I 4° CMF", categorie: "geographie", categories: ["geographie"], ponderation: 100, reponse_risquee: "OUI", ordre: 2 },
  { id: "atypique", code: "atypique", libelle: "Le montage juridique du client est-il atypique ou complexe sans justification économique ?", description: "Art. L.561-10-2 CMF", categorie: "structure", categories: ["structure"], ponderation: 100, reponse_risquee: "OUI", ordre: 3 },
  { id: "distanciel", code: "distanciel", libelle: "La relation d'affaires est-elle intégralement à distance ?", description: "Art. R.561-5-2 CMF", categorie: "comportement", categories: ["comportement"], ponderation: 40, reponse_risquee: "OUI", ordre: 4 },
  { id: "cash", code: "cash", libelle: "L'activité du client implique-t-elle la manipulation d'espèces significatives ?", description: "Art. L.561-15 CMF", categorie: "comportement", categories: ["comportement"], ponderation: 30, reponse_risquee: "OUI", ordre: 5 },
  { id: "pression", code: "pression", libelle: "Le client exerce-t-il une pression ou une urgence inhabituelle sur les délais ?", description: "Art. L.561-10-2 3° CMF", categorie: "comportement", categories: ["comportement"], ponderation: 50, reponse_risquee: "OUI", ordre: 6 },
  { id: "changeJuridiques", code: "changeJuridiques", libelle: "Le client a-t-il effectué des changements juridiques fréquents ?", description: "Art. R.561-38 CMF", categorie: "structure", categories: ["structure"], ponderation: 20, reponse_risquee: "OUI", ordre: 7 },
  { id: "structureComplexe", code: "structureComplexe", libelle: "La structure capitalistique est-elle opaque ou anormalement complexe ?", description: "Art. L.561-10 II CMF", categorie: "structure", categories: ["structure"], ponderation: 30, reponse_risquee: "OUI", ordre: 8 },
  { id: "filialesEtrangeres", code: "filialesEtrangeres", libelle: "Le client détient-il des filiales dans des pays à fiscalité privilégiée ?", description: "Art. L.561-10 I 4° CMF", categorie: "geographie", categories: ["geographie"], ponderation: 25, reponse_risquee: "OUI", ordre: 9 },
  { id: "transactionsPays", code: "transactionsPays", libelle: "Des transactions significatives sont-elles réalisées avec des pays à risque ?", description: "Art. L.561-15 II CMF", categorie: "geographie", categories: ["geographie"], ponderation: 25, reponse_risquee: "OUI", ordre: 10 },
  { id: "mouvementsCash", code: "mouvementsCash", libelle: "Des mouvements d'argent liquide inhabituels sont-ils constatés ?", description: "Art. L.561-15 CMF", categorie: "comportement", categories: ["comportement"], ponderation: 30, reponse_risquee: "OUI", ordre: 11 },
  { id: "capitalInconnus", code: "capitalInconnus", libelle: "Le capital social est-il détenu par des personnes non identifiées ou des sociétés écran ?", description: "Art. L.561-2-2 CMF", categorie: "structure", categories: ["structure"], ponderation: 50, reponse_risquee: "OUI", ordre: 12 },
  { id: "fournisseursPays", code: "fournisseursPays", libelle: "Les principaux fournisseurs sont-ils situés dans des pays à risque ?", description: "Art. L.561-10 I CMF", categorie: "geographie", categories: ["geographie"], ponderation: 20, reponse_risquee: "OUI", ordre: 13 },
];

export function useQuestionsLCB() {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<QuestionLCBFromDB[]>(FALLBACK_QUESTIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile?.cabinet_id) return;
    setLoading(true);

    supabase.from("ref_questions")
      .select("*")
      .eq("cabinet_id", profile.cabinet_id)
      .eq("parametres_pilotes", true)
      .order("ordre", { ascending: true })
      .then(({ data, error }) => {
        if (data && data.length > 0) {
          const mapped: QuestionLCBFromDB[] = data.map((q: any) => ({
            id: q.code || q.id,
            code: q.code || "",
            libelle: q.libelle || "",
            description: q.description || "",
            categorie: q.categorie || null,
            categories: q.categories || [],
            ponderation: q.ponderation || 0,
            reponse_risquee: q.reponse_risquee || "OUI",
            ordre: q.ordre || 0,
          }));
          setQuestions(mapped);
        } else {
          logger.warn("useQuestionsLCB", "No questions in DB, using fallback. Error:", error?.message);
        }
        setLoading(false);
      });
  }, [profile?.cabinet_id]);

  return { questions, loading };
}
