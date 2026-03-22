import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Upload, Save, Palette, PenTool, CreditCard } from "lucide-react";
import { toast } from "sonner";

export interface CabinetConfig {
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  siret: string;
  numeroOec: string;
  email: string;
  telephone: string;
  siteWeb: string;
  logo: string;
  signature: string;
  couleurPrimaire: string;
  couleurSecondaire: string;
  police: string;
  piedDePage: string;
  icsSepa: string;
  // Extended fields
  croec: string;
  assureurNom: string;
  assureurAdresse: string;
  tvaIntracommunautaire: string;
}

const DEFAULT_CONFIG: CabinetConfig = {
  nom: "",
  adresse: "",
  cp: "",
  ville: "",
  siret: "",
  numeroOec: "",
  email: "",
  telephone: "",
  siteWeb: "",
  logo: "",
  signature: "",
  couleurPrimaire: "#1e40af",
  couleurSecondaire: "#64748b",
  police: "Inter",
  piedDePage: "Membre de l'Ordre des Experts-Comptables",
  icsSepa: "",
  croec: "",
  assureurNom: "",
  assureurAdresse: "",
  tvaIntracommunautaire: "",
};

const STORAGE_KEY = "lcb-cabinet-config";
const FONTS = ["Inter", "Roboto", "Times New Roman", "Arial"];

export function loadCabinetConfig(): CabinetConfig {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export default function CabinetConfigForm() {
  const [config, setConfig] = useState<CabinetConfig>(DEFAULT_CONFIG);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfig(loadCabinetConfig());
  }, []);

  const update = (field: keyof CabinetConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* storage full */ }
    toast.success("Configuration du cabinet sauvegardee");
  };

  const handleFileUpload = (field: "logo" | "signature", maxKb: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxKb * 1024) {
      toast.error(`Le fichier ne doit pas depasser ${maxKb} Ko`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update(field, reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-6">
        {/* Informations */}
        <Card className="bg-card/80 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-blue-400" />
              Informations du cabinet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Nom du cabinet</Label>
                <Input value={config.nom} onChange={(e) => update("nom", e.target.value)} placeholder="Cabinet Expertise Comptable" className="bg-background/50 border-white/10" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Adresse</Label>
                <Input value={config.adresse} onChange={(e) => update("adresse", e.target.value)} placeholder="12 rue de la Paix" className="bg-background/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Code postal</Label>
                <Input value={config.cp} onChange={(e) => update("cp", e.target.value)} placeholder="75001" className="bg-background/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ville</Label>
                <Input value={config.ville} onChange={(e) => update("ville", e.target.value)} placeholder="Paris" className="bg-background/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SIRET</Label>
                <Input value={config.siret} onChange={(e) => update("siret", e.target.value)} placeholder="123 456 789 00012" className="bg-background/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Numero OEC</Label>
                <Input value={config.numeroOec} onChange={(e) => update("numeroOec", e.target.value)} placeholder="IDF-12345" className="bg-background/50 border-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-card/80 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={config.email} onChange={(e) => update("email", e.target.value)} placeholder="contact@cabinet.fr" type="email" className="bg-background/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telephone</Label>
                <Input value={config.telephone} onChange={(e) => update("telephone", e.target.value)} placeholder="01 23 45 67 89" className="bg-background/50 border-white/10" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Site web</Label>
                <Input value={config.siteWeb} onChange={(e) => update("siteWeb", e.target.value)} placeholder="https://www.cabinet.fr" className="bg-background/50 border-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assurance & Identite professionnelle */}
        <Card className="bg-card/80 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-emerald-400" />
              Identite professionnelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">CROEC d'inscription</Label>
                <Input value={config.croec} onChange={(e) => update("croec", e.target.value)} placeholder="CROEC Provence-Alpes-Cote d'Azur" className="bg-background/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">N° TVA intracommunautaire</Label>
                <Input value={config.tvaIntracommunautaire} onChange={(e) => update("tvaIntracommunautaire", e.target.value)} placeholder="FR12345678901" className="bg-background/50 border-white/10" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Assureur RC Professionnelle</Label>
                <Input value={config.assureurNom} onChange={(e) => update("assureurNom", e.target.value)} placeholder="MMA IARD" className="bg-background/50 border-white/10" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Adresse assureur</Label>
                <Input value={config.assureurAdresse} onChange={(e) => update("assureurAdresse", e.target.value)} placeholder="14 bd Marie et Alexandre OYON, 72030 Le Mans" className="bg-background/50 border-white/10" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SEPA */}
        <Card className="bg-card/80 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-5 w-5 text-violet-400" />
              Prelevement SEPA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs text-muted-foreground">Identifiant Creancier SEPA (ICS)</Label>
              <Input value={config.icsSepa} onChange={(e) => update("icsSepa", e.target.value)} placeholder="FR12ZZZ123456" className="bg-background/50 border-white/10" />
              <p className="text-[10px] text-muted-foreground mt-1">Necessaire pour les mandats de prelevement SEPA</p>
            </div>
          </CardContent>
        </Card>

        {/* Apparence */}
        <Card className="bg-card/80 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-5 w-5 text-amber-400" />
              Apparence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo */}
            <div>
              <Label className="text-xs text-muted-foreground">Logo du cabinet</Label>
              <div className="flex items-center gap-3 mt-1">
                {config.logo ? (
                  <img src={config.logo} alt="Logo" className="h-14 w-14 object-contain rounded-lg border border-white/10 bg-white p-1" />
                ) : (
                  <div className="h-14 w-14 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
                <div className="space-y-1">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {config.logo ? "Changer" : "Uploader"}
                  </Button>
                  {config.logo && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => update("logo", "")}>
                      Supprimer
                    </Button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload("logo", 500)} />
              </div>
            </div>

            {/* Signature */}
            <div>
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <PenTool className="h-3 w-3" />
                Signature manuscrite numerisee
              </Label>
              <div className="flex items-center gap-3 mt-1">
                {config.signature ? (
                  <img src={config.signature} alt="Signature" className="h-14 object-contain rounded-lg border border-white/10 bg-white px-3 py-1" />
                ) : (
                  <div className="h-14 w-32 rounded-lg border border-dashed border-white/20 flex items-center justify-center">
                    <PenTool className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                )}
                <div className="space-y-1">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => signatureInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    {config.signature ? "Changer" : "Uploader"}
                  </Button>
                  {config.signature && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => update("signature", "")}>
                      Supprimer
                    </Button>
                  )}
                </div>
                <input ref={signatureInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload("signature", 300)} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Image PNG/JPG sur fond transparent ou blanc, max 300 Ko</p>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Couleur primaire</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={config.couleurPrimaire}
                    onChange={(e) => update("couleurPrimaire", e.target.value)}
                    className="h-9 w-12 rounded border border-white/10 cursor-pointer bg-transparent"
                  />
                  <Input value={config.couleurPrimaire} onChange={(e) => update("couleurPrimaire", e.target.value)} className="flex-1 bg-background/50 border-white/10" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Couleur secondaire</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={config.couleurSecondaire}
                    onChange={(e) => update("couleurSecondaire", e.target.value)}
                    className="h-9 w-12 rounded border border-white/10 cursor-pointer bg-transparent"
                  />
                  <Input value={config.couleurSecondaire} onChange={(e) => update("couleurSecondaire", e.target.value)} className="flex-1 bg-background/50 border-white/10" />
                </div>
              </div>
            </div>

            {/* Font */}
            <div>
              <Label className="text-xs text-muted-foreground">Police</Label>
              <Select value={config.police} onValueChange={(v) => update("police", v)}>
                <SelectTrigger className="bg-background/50 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Footer text */}
            <div>
              <Label className="text-xs text-muted-foreground">Texte pied de page</Label>
              <Input value={config.piedDePage} onChange={(e) => update("piedDePage", e.target.value)} placeholder="Membre de l'Ordre des Experts-Comptables" className="bg-background/50 border-white/10" />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-slate-900 dark:text-white shadow-lg shadow-blue-500/20" onClick={handleSave}>
          <Save className="h-4 w-4" />
          Sauvegarder la configuration
        </Button>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-6 self-start">
        <Card className="bg-card/80 backdrop-blur border-white/10">
          <CardHeader>
            <CardTitle className="text-base">Apercu de l'en-tete</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border border-gray-200 rounded-lg p-6 bg-white text-black shadow-inner"
              style={{ fontFamily: config.police }}
            >
              <div className="flex items-start gap-4 mb-4">
                {config.logo ? (
                  <img src={config.logo} alt="Logo" className="h-16 w-16 object-contain" />
                ) : (
                  <div className="h-16 w-16 rounded bg-gray-100 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-gray-700 dark:text-gray-300" />
                  </div>
                )}
                <div>
                  <h2
                    className="text-lg font-bold"
                    style={{ color: config.couleurPrimaire }}
                  >
                    {config.nom || "Nom du cabinet"}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {config.adresse && `${config.adresse}, `}
                    {config.cp} {config.ville}
                  </p>
                  <p className="text-sm text-gray-600">
                    {config.email && `${config.email} | `}
                    {config.telephone}
                  </p>
                </div>
              </div>
              <div
                className="h-1 w-full rounded"
                style={{
                  background: `linear-gradient(to right, ${config.couleurPrimaire}, ${config.couleurSecondaire})`,
                }}
              />
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-500 space-y-0.5">
                <p>SIRET : {config.siret || "---"} | N° OEC : {config.numeroOec || "---"}</p>
                {config.croec && <p className="text-xs">CROEC : {config.croec}</p>}
                {config.tvaIntracommunautaire && <p className="text-xs">TVA : {config.tvaIntracommunautaire}</p>}
                {config.assureurNom && <p className="text-xs">Assurance RC Pro : {config.assureurNom}{config.assureurAdresse ? `, ${config.assureurAdresse}` : ""}</p>}
                {config.icsSepa && <p className="text-xs">ICS : {config.icsSepa}</p>}
              </div>

              {/* Signature preview */}
              {config.signature && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Signature :</p>
                  <img src={config.signature} alt="Signature" className="h-12 object-contain" />
                </div>
              )}

              <div className="mt-4 border-t pt-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center" style={{ color: config.couleurSecondaire }}>
                  {config.piedDePage || "Pied de page"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
