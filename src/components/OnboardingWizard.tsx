import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2, Users, UserPlus, ArrowRight, ArrowLeft, Check, SkipForward,
} from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "grimy-onboarding-complete";

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function markOnboardingComplete(): void {
  try { localStorage.setItem(STORAGE_KEY, "true"); } catch { /* storage full */ }
}

interface StepIndicatorProps {
  current: number;
  total: number;
}

function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i === current ? "w-8 bg-blue-500" : i < current ? "w-8 bg-blue-300" : "w-8 bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [step, setStep] = useState(0);

  // Step 1: Cabinet config
  const [cabinetNom, setCabinetNom] = useState("");
  const [cabinetSiret, setCabinetSiret] = useState("");
  const [cabinetAdresse, setCabinetAdresse] = useState("");
  const [savingCabinet, setSavingCabinet] = useState(false);

  // Step 2: Invite collaborator
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("COLLABORATEUR");
  const [inviting, setInviting] = useState(false);

  async function handleSaveCabinet() {
    if (!cabinetNom.trim()) {
      toast.error("Le nom du cabinet est requis");
      return;
    }

    setSavingCabinet(true);
    const cabinetId = profile?.cabinet_id;
    if (!cabinetId) {
      toast.error("Cabinet introuvable");
      setSavingCabinet(false);
      return;
    }

    const { error } = await supabase
      .from("cabinets")
      .update({ nom: cabinetNom.trim(), siren: cabinetSiret.trim() || null, adresse: cabinetAdresse.trim() || null })
      .eq("id", cabinetId);

    setSavingCabinet(false);

    if (error) {
      toast.error("Erreur lors de la sauvegarde");
      return;
    }

    toast.success("Cabinet configure !");
    setStep(1);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      toast.error("L'email est requis");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(inviteEmail.trim())) {
      toast.error("Format email invalide");
      return;
    }

    setInviting(true);

    const { error } = await supabase.functions.invoke("invite-user", {
      body: { email: inviteEmail.trim(), role: inviteRole },
    });

    setInviting(false);

    if (error) {
      toast.error("Erreur lors de l'envoi de l'invitation");
      return;
    }

    toast.success(`Invitation envoyee a ${inviteEmail}`);
    setStep(2);
  }

  function handleFinish() {
    markOnboardingComplete();
    navigate("/nouveau-client");
  }

  const [dismissed, setDismissed] = useState(false);

  function handleSkipAll() {
    markOnboardingComplete();
    setDismissed(true);
  }

  if (dismissed) return null;

  const STEPS = [
    {
      icon: Building2,
      title: "Configurez votre cabinet",
      description: "Renseignez les informations de base de votre cabinet",
    },
    {
      icon: UserPlus,
      title: "Invitez un collaborateur",
      description: "Ajoutez un membre de votre equipe (optionnel)",
    },
    {
      icon: Users,
      title: "Creez votre premier client",
      description: "Commencez a gerer votre portefeuille clients",
    },
  ];

  const currentStep = STEPS[step];

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <currentStep.icon className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Bienvenue sur GRIMY</CardTitle>
              <CardDescription>Etape {step + 1} sur 3</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSkipAll} className="text-xs text-muted-foreground">
            Passer l'assistant
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <StepIndicator current={step} total={3} />

        {step === 0 && (
          <div className="space-y-4">
            <h3 className="font-medium">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="cabinet-nom">Nom du cabinet *</Label>
                <Input
                  id="cabinet-nom"
                  placeholder="Ex: Cabinet Martin & Associes"
                  value={cabinetNom}
                  onChange={(e) => setCabinetNom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cabinet-siret">SIRET</Label>
                <Input
                  id="cabinet-siret"
                  placeholder="Ex: 123 456 789 00012"
                  value={cabinetSiret}
                  onChange={(e) => setCabinetSiret(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="cabinet-adresse">Adresse</Label>
                <Input
                  id="cabinet-adresse"
                  placeholder="Ex: 12 rue de la Paix, 75001 Paris"
                  value={cabinetAdresse}
                  onChange={(e) => setCabinetAdresse(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleSaveCabinet} disabled={savingCabinet} className="w-full">
              {savingCabinet ? "Enregistrement..." : "Continuer"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="invite-email">Email du collaborateur</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="collaborateur@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option value="COLLABORATEUR">Collaborateur</option>
                  <option value="SUPERVISEUR">Superviseur</option>
                  <option value="STAGIAIRE">Stagiaire</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                <SkipForward className="w-4 h-4 mr-2" />
                Passer
              </Button>
              <Button onClick={handleInvite} disabled={inviting} className="flex-1">
                {inviting ? "Envoi..." : "Inviter"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-medium">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">
              Votre cabinet est pret ! Creez maintenant votre premier dossier client pour commencer a utiliser GRIMY.
            </p>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button onClick={handleFinish}>
                Creer un client
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
