import { type ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bell, Building2, KeyRound, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type SettingsState = {
  cabinetName: string;
  cabinetSiren: string;
  contactEmail: string;
  timezone: string;
  locale: string;
  logoUrl: string;
  vigilanceRefresh: string;
  alertsDigest: string;
  webhookUrl: string;
  pappersEnabled: boolean;
  twoFactorRequired: boolean;
  sessionTimeout: string;
  inactivityAutoLogout: boolean;
  showMotionEffects: boolean;
  highContrast: boolean;
  compactTables: boolean;
  emailNotif: boolean;
  pushNotif: boolean;
  weeklyComplianceReport: boolean;
  defaultReviewer: string;
  reviewerRules: string;
};

const DEFAULT_SETTINGS: SettingsState = {
  cabinetName: "Cabinet O90",
  cabinetSiren: "123456789",
  contactEmail: "conformite@cabinet-o90.fr",
  timezone: "Europe/Paris",
  locale: "fr-FR",
  logoUrl: "",
  vigilanceRefresh: "monthly",
  alertsDigest: "daily",
  webhookUrl: "",
  pappersEnabled: true,
  twoFactorRequired: true,
  sessionTimeout: "30",
  inactivityAutoLogout: true,
  showMotionEffects: true,
  highContrast: false,
  compactTables: false,
  emailNotif: true,
  pushNotif: true,
  weeklyComplianceReport: true,
  defaultReviewer: "Superviseur",
  reviewerRules: "Prioriser les dossiers RENFORCEE et les clients en retard.",
};

const STORAGE_KEY = "o90.settings";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SettingsState>) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const completion = useMemo(() => {
    const requiredFields = [settings.cabinetName, settings.cabinetSiren, settings.contactEmail, settings.timezone, settings.locale];
    const ok = requiredFields.filter(Boolean).length;
    return Math.round((ok / requiredFields.length) * 100);
  }, [settings]);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    const stamp = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setLastSavedAt(stamp);
    toast.success("Parametres enregistres");
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
    setLastSavedAt(null);
    toast.message("Parametres reinitialises");
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Parametres du cabinet</h1>
          <p className="text-sm text-slate-400">Configuration inspiree d&apos;un cockpit conformite type Kanta.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-200 border border-blue-500/30">
            Setup: {completion}%
          </Badge>
          <Button variant="outline" onClick={reset}>Reinitialiser</Button>
          <Button onClick={save}>Enregistrer</Button>
          {lastSavedAt ? <span className="text-xs text-slate-500">Derniere sauvegarde: {lastSavedAt}</span> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-400" /> Identite cabinet</CardTitle>
            <CardDescription>Informations generales du cabinet et preference regionale.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="cabinetName">Nom du cabinet</Label><Input id="cabinetName" value={settings.cabinetName} onChange={(e) => update("cabinetName", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="cabinetSiren">SIREN</Label><Input id="cabinetSiren" value={settings.cabinetSiren} onChange={(e) => update("cabinetSiren", e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="contactEmail">Email conformite</Label><Input id="contactEmail" type="email" value={settings.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Fuseau horaire</Label><Select value={settings.timezone} onValueChange={(v) => update("timezone", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Europe/Paris">Europe/Paris</SelectItem><SelectItem value="Europe/Brussels">Europe/Brussels</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Langue</Label><Select value={settings.locale} onValueChange={(v) => update("locale", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fr-FR">Francais</SelectItem><SelectItem value="en-US">English</SelectItem></SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label htmlFor="logoUrl">URL logo</Label><Input id="logoUrl" value={settings.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://..." /></div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Conformite & controle</CardTitle>
            <CardDescription>Regles LCB-FT, frequence de revue et policies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Frequence de rafraichissement vigilance</Label><Select value={settings.vigilanceRefresh} onValueChange={(v) => update("vigilanceRefresh", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Hebdomadaire</SelectItem><SelectItem value="monthly">Mensuelle</SelectItem><SelectItem value="quarterly">Trimestrielle</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Relecteur par defaut</Label><Input value={settings.defaultReviewer} onChange={(e) => update("defaultReviewer", e.target.value)} /></div>
            <div className="space-y-2"><Label>Regles de priorisation</Label><Textarea value={settings.reviewerRules} onChange={(e) => update("reviewerRules", e.target.value)} rows={4} /></div>
            <Separator />
            <ToggleRow label="Activer l'integration Pappers" description="Enrichissement des dossiers societe." checked={settings.pappersEnabled} onCheckedChange={(v) => update("pappersEnabled", v)} />
            <ToggleRow label="Rapport conformite hebdomadaire" description="Envoi automatique au management." checked={settings.weeklyComplianceReport} onCheckedChange={(v) => update("weeklyComplianceReport", v)} />
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" /> Notifications</CardTitle>
            <CardDescription>Canaux et frequence des alertes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Digest alertes</Label><Select value={settings.alertsDigest} onValueChange={(v) => update("alertsDigest", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="realtime">Temps reel</SelectItem><SelectItem value="daily">Quotidien</SelectItem><SelectItem value="weekly">Hebdomadaire</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="webhookUrl">Webhook (Slack / Teams)</Label><Input id="webhookUrl" value={settings.webhookUrl} onChange={(e) => update("webhookUrl", e.target.value)} placeholder="https://hooks..." /></div>
            <ToggleRow label="Notifications email" description="Reception dans la boite conformite." checked={settings.emailNotif} onCheckedChange={(v) => update("emailNotif", v)} />
            <ToggleRow label="Notifications in-app" description="Bannieres et centre de notifications." checked={settings.pushNotif} onCheckedChange={(v) => update("pushNotif", v)} />
          </CardContent>
        </Card>

        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-red-400" /> Securite & accessibilite</CardTitle>
            <CardDescription>Politiques de session et confort utilisateur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Timeout session (minutes)</Label><Select value={settings.sessionTimeout} onValueChange={(v) => update("sessionTimeout", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 min</SelectItem><SelectItem value="30">30 min</SelectItem><SelectItem value="60">60 min</SelectItem></SelectContent></Select></div>
            <ToggleRow label="2FA obligatoire" description="Authentification forte pour tous les profils." checked={settings.twoFactorRequired} onCheckedChange={(v) => update("twoFactorRequired", v)} />
            <ToggleRow label="Deconnexion auto inactivite" description="Protege les sessions laissees ouvertes." checked={settings.inactivityAutoLogout} onCheckedChange={(v) => update("inactivityAutoLogout", v)} />
            <Separator />
            <ToggleRow label="Animations reduites" description="Diminue les effets pour une meilleure lisibilite." checked={!settings.showMotionEffects} onCheckedChange={(v) => update("showMotionEffects", !v)} />
            <ToggleRow label="Mode contraste renforce" description="Ameliore la lisibilite des interfaces." checked={settings.highContrast} onCheckedChange={(v) => update("highContrast", v)} />
            <ToggleRow label="Tables compactes" description="Affiche plus de lignes par ecran." checked={settings.compactTables} onCheckedChange={(v) => update("compactTables", v)} />
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-400" /> Gouvernance des acces</CardTitle>
          <CardDescription>Fonctions recommandees pour une gestion type Kanta.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-300">
          <FeatureBullet icon={<SlidersHorizontal className="w-4 h-4 text-blue-300" />} label="Matrice de permissions par role" />
          <FeatureBullet icon={<SlidersHorizontal className="w-4 h-4 text-blue-300" />} label="Validation 4-yeux sur modifications sensibles" />
          <FeatureBullet icon={<SlidersHorizontal className="w-4 h-4 text-blue-300" />} label="Historique complet des changements" />
          <FeatureBullet icon={<SlidersHorizontal className="w-4 h-4 text-blue-300" />} label="Exports conformite (PDF/CSV)" />
          <FeatureBullet icon={<SlidersHorizontal className="w-4 h-4 text-blue-300" />} label="Mode lecture seule pour auditeurs externes" />
          <FeatureBullet icon={<SlidersHorizontal className="w-4 h-4 text-blue-300" />} label="Escalade automatique des alertes critiques" />
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-3">
      <div>
        <p className="text-sm text-slate-100">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

function FeatureBullet({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] p-3">{icon}<span>{label}</span></div>;
}
