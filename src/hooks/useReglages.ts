import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";

export interface CabinetReglages {
  restreindre_visibilite_affectations: boolean;
  restreindre_visibilite_cabinet: boolean;
  restreindre_validation_responsables: boolean;
  limiter_exports_auteur: boolean;
  limiter_notifications_affectes: boolean;
  bloquer_demandes_validation_incompletes: boolean;
  bloquer_validations_incompletes: boolean;
  generation_auto_maintiens: boolean;
  documents_expires_manquants: boolean;
  mises_a_jour_externes: boolean;
  notif_revue_echue: boolean;
  notif_doc_expire: boolean;
  notif_alerte_ouverte: boolean;
  frequence_maj_externe: string;
  email_responsable_alertes: string | null;
  seuil_score_alerte: number;
  delai_rappel_signature_jours: number;
  auto_archive_lettres_jours: number;
  purge_brouillons_jours: number;
  delai_suspension_jours: number;
  forcer_2fa: boolean;
  mode_strict_lcb: boolean;
  autoriser_acces_stagiaire_docs: boolean;
  limite_taille_upload_mo: number;
}

const DEFAULTS: CabinetReglages = {
  restreindre_visibilite_affectations: false,
  restreindre_visibilite_cabinet: false,
  restreindre_validation_responsables: false,
  limiter_exports_auteur: false,
  limiter_notifications_affectes: false,
  bloquer_demandes_validation_incompletes: false,
  bloquer_validations_incompletes: false,
  generation_auto_maintiens: true,
  documents_expires_manquants: true,
  mises_a_jour_externes: true,
  notif_revue_echue: true,
  notif_doc_expire: true,
  notif_alerte_ouverte: true,
  frequence_maj_externe: "quotidien",
  email_responsable_alertes: null,
  seuil_score_alerte: 60,
  delai_rappel_signature_jours: 7,
  auto_archive_lettres_jours: 365,
  purge_brouillons_jours: 90,
  delai_suspension_jours: 90,
  forcer_2fa: false,
  mode_strict_lcb: false,
  autoriser_acces_stagiaire_docs: false,
  limite_taille_upload_mo: 10,
};

export function useReglages() {
  const { profile } = useAuth();
  const [reglages, setReglages] = useState<CabinetReglages>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.cabinet_id) return;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase.rpc("get_all_cabinet_reglages");
        if (!cancelled && data) setReglages({ ...DEFAULTS, ...data });
      } catch {
        // fallback to defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [profile?.cabinet_id]);

  return { reglages, loading };
}
