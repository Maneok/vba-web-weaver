import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { OnboardingProgressBar } from "@/components/onboarding/OnboardingProgressBar";
import { OnboardingStep1Cabinet, type CabinetData } from "@/components/onboarding/OnboardingStep1Cabinet";
import { OnboardingStep2Responsable, type ResponsableData } from "@/components/onboarding/OnboardingStep2Responsable";
import { OnboardingStep3Preferences, type PreferencesData } from "@/components/onboarding/OnboardingStep3Preferences";
import { OnboardingComplete } from "@/components/onboarding/OnboardingComplete";

const STEP_PERCENT = [20, 50, 80, 100] as const;

export default function OnboardingPage() {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [cabinetData, setCabinetData] = useState<CabinetData>({
    siret: "",
    nom: "",
    adresse: "",
    cp: "",
    ville: "",
    formeJuridique: "",
  });

  const [responsableData, setResponsableData] = useState<ResponsableData>({
    nom: profile?.full_name || user?.email?.split("@")[0] || "",
    email: user?.email || "",
    telephone: "",
    fonction: "Expert-comptable",
  });

  const [preferencesData, setPreferencesData] = useState<PreferencesData>({
    vigilanceDefaut: "STANDARD",
    frequenceRevue: "ANNUELLE",
  });

  // Save all data to Supabase parametres table
  const saveOnboarding = useCallback(async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Helper to upsert a parametres row
      const upsertParam = async (key: string, value: unknown) => {
        const jsonValue = JSON.stringify(value);
        const { error } = await supabase
          .from("parametres")
          .upsert(
            { user_id: user.id, cle: key, valeur: jsonValue, updated_at: new Date().toISOString() },
            { onConflict: "user_id,cle" }
          );
        if (error) {
          logger.warn("Onboarding", `upsert ${key} failed:`, error.message);
        }
      };

      // Save cabinet info
      await upsertParam("cabinet_info", {
        nom: cabinetData.nom,
        adresse: cabinetData.adresse,
        cp: cabinetData.cp,
        ville: cabinetData.ville,
        siret: cabinetData.siret.replace(/\s/g, ""),
        forme_juridique: cabinetData.formeJuridique,
        email: responsableData.email,
        telephone: responsableData.telephone,
      });

      // Save LCB-FT config
      await upsertParam("lcbft_config", {
        referent_lcb: responsableData.nom,
        fonction_referent: responsableData.fonction,
      });

      // Save scoring preferences
      const freqMonths = preferencesData.frequenceRevue === "TRIMESTRIELLE" ? 3
        : preferencesData.frequenceRevue === "SEMESTRIELLE" ? 6 : 12;
      await upsertParam("scoring_config", {
        vigilance_defaut: preferencesData.vigilanceDefaut,
        revue_standard_mois: freqMonths * 2,
        revue_renforcee_mois: freqMonths,
        revue_simplifiee_mois: freqMonths * 3,
      });

      // Mark onboarding as completed
      await upsertParam("onboarding_completed", true);

      logger.info("Onboarding", "Onboarding completed for user:", user.id);
    } catch (err) {
      logger.error("Onboarding", "Failed to save onboarding data:", err);
      toast.error("Erreur lors de la sauvegarde. Vos donnees seront conservees.");
    } finally {
      setSaving(false);
    }
  }, [user, cabinetData, responsableData, preferencesData]);

  const handleFinishStep3 = useCallback(async () => {
    await saveOnboarding();
    setStep(3);
  }, [saveOnboarding]);

  const handleSkipToEnd = useCallback(async () => {
    await saveOnboarding();
    setStep(3);
  }, [saveOnboarding]);

  const percent = STEP_PERCENT[step] ?? 20;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo / Brand */}
      <div className="mb-6 text-center">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-blue-400">GRIMY</span>
          <span className="text-slate-500 font-normal ml-2 text-sm">Conformite LCB-FT</span>
        </h1>
      </div>

      {/* Progress bar (hidden on final screen) */}
      {step < 3 && <OnboardingProgressBar percent={percent} />}

      {/* Card */}
      <div className="w-full max-w-xl mx-auto bg-card border border-border rounded-2xl p-8 shadow-lg shadow-black/20">
        {step === 0 && (
          <OnboardingStep1Cabinet
            data={cabinetData}
            onChange={setCabinetData}
            onNext={() => setStep(1)}
            onSkip={handleSkipToEnd}
          />
        )}

        {step === 1 && (
          <OnboardingStep2Responsable
            data={responsableData}
            onChange={setResponsableData}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            onSkip={handleSkipToEnd}
          />
        )}

        {step === 2 && (
          <OnboardingStep3Preferences
            data={preferencesData}
            onChange={setPreferencesData}
            onNext={handleFinishStep3}
            onBack={() => setStep(1)}
            onSkip={handleSkipToEnd}
          />
        )}

        {step === 3 && (
          <OnboardingComplete
            cabinetName={cabinetData.nom}
            responsableName={responsableData.nom}
            cabinetData={cabinetData}
          />
        )}
      </div>

      {/* Footer */}
      {step < 3 && (
        <p className="mt-6 text-xs text-slate-600 text-center">
          Vous pourrez modifier ces informations a tout moment dans les parametres.
        </p>
      )}

      {saving && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 flex items-center gap-3">
            <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-300">Enregistrement en cours...</span>
          </div>
        </div>
      )}
    </div>
  );
}
