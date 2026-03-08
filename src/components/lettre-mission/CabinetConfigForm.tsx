import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Upload, Save } from "lucide-react";
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
  couleurPrimaire: string;
  couleurSecondaire: string;
  police: string;
  piedDePage: string;
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
  couleurPrimaire: "#1e40af",
  couleurSecondaire: "#64748b",
  police: "Inter",
  piedDePage: "Membre de l'Ordre des Experts-Comptables",
};

const STORAGE_KEY = "lcb-cabinet-config";
const FONTS = ["Inter", "Roboto", "Times New Roman", "Arial"];

export function loadCabinetConfig(): CabinetConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

export default function CabinetConfigForm() {
  const [config, setConfig] = useState<CabinetConfig>(DEFAULT_CONFIG);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfig(loadCabinetConfig());
  }, []);

  const update = (field: keyof CabinetConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast.success("Configuration du cabinet sauvegardee");
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      toast.error("Le logo ne doit pas depasser 500 Ko");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update("logo", reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5" />
              Informations du cabinet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nom du cabinet</Label>
                <Input value={config.nom} onChange={(e) => update("nom", e.target.value)} placeholder="Cabinet Expertise Comptable" />
              </div>
              <div className="col-span-2">
                <Label>Adresse</Label>
                <Input value={config.adresse} onChange={(e) => update("adresse", e.target.value)} placeholder="12 rue de la Paix" />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input value={config.cp} onChange={(e) => update("cp", e.target.value)} placeholder="75001" />
              </div>
              <div>
                <Label>Ville</Label>
                <Input value={config.ville} onChange={(e) => update("ville", e.target.value)} placeholder="Paris" />
              </div>
              <div>
                <Label>SIRET</Label>
                <Input value={config.siret} onChange={(e) => update("siret", e.target.value)} placeholder="123 456 789 00012" />
              </div>
              <div>
                <Label>Numero OEC</Label>
                <Input value={config.numeroOec} onChange={(e) => update("numeroOec", e.target.value)} placeholder="IDF-12345" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input value={config.email} onChange={(e) => update("email", e.target.value)} placeholder="contact@cabinet.fr" type="email" />
              </div>
              <div>
                <Label>Telephone</Label>
                <Input value={config.telephone} onChange={(e) => update("telephone", e.target.value)} placeholder="01 23 45 67 89" />
              </div>
              <div className="col-span-2">
                <Label>Site web</Label>
                <Input value={config.siteWeb} onChange={(e) => update("siteWeb", e.target.value)} placeholder="https://www.cabinet.fr" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apparence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Logo du cabinet</Label>
              <div className="flex items-center gap-3 mt-1">
                {config.logo && (
                  <img src={config.logo} alt="Logo" className="h-12 w-12 object-contain rounded border" />
                )}
                <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  {config.logo ? "Changer" : "Uploader"}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Couleur primaire</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={config.couleurPrimaire}
                    onChange={(e) => update("couleurPrimaire", e.target.value)}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input value={config.couleurPrimaire} onChange={(e) => update("couleurPrimaire", e.target.value)} className="flex-1" />
                </div>
              </div>
              <div>
                <Label>Couleur secondaire</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={config.couleurSecondaire}
                    onChange={(e) => update("couleurSecondaire", e.target.value)}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input value={config.couleurSecondaire} onChange={(e) => update("couleurSecondaire", e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>
            <div>
              <Label>Police</Label>
              <Select value={config.police} onValueChange={(v) => update("police", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTS.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Texte pied de page</Label>
              <Input value={config.piedDePage} onChange={(e) => update("piedDePage", e.target.value)} placeholder="Membre de l'Ordre des Experts-Comptables" />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full gap-2" onClick={handleSave}>
          <Save className="h-4 w-4" />
          Sauvegarder la configuration
        </Button>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Apercu de l'en-tete</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border rounded-lg p-6 bg-white text-black"
              style={{ fontFamily: config.police }}
            >
              <div className="flex items-start gap-4 mb-4">
                {config.logo && (
                  <img src={config.logo} alt="Logo" className="h-16 w-16 object-contain" />
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
              <div className="mt-4 text-sm text-gray-500">
                <p>SIRET : {config.siret || "---"} | N° OEC : {config.numeroOec || "---"}</p>
              </div>
              <div className="mt-6 border-t pt-3">
                <p className="text-xs text-gray-400 text-center" style={{ color: config.couleurSecondaire }}>
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
