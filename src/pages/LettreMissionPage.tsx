import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, LayoutTemplate, History, Settings } from "lucide-react";
import ClientSelector from "@/components/lettre-mission/ClientSelector";
import LettreMissionEditor, { DEFAULT_DATA, type LettreMissionData } from "@/components/lettre-mission/LettreMissionEditor";
import LettreMissionPreviewV2 from "@/components/lettre-mission/LettreMissionPreviewV2";
import TemplateManager from "@/components/lettre-mission/TemplateManager";
import LettreMissionHistory from "@/components/lettre-mission/LettreMissionHistory";
import CabinetConfigForm, { loadCabinetConfig } from "@/components/lettre-mission/CabinetConfigForm";
import type { Client } from "@/lib/types";

export default function LettreMissionPage() {
  const [selectedClientRef, setSelectedClientRef] = useState<string | null>(null);
  const [data, setData] = useState<LettreMissionData>({ ...DEFAULT_DATA });
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const handleClientSelect = useCallback((client: Client) => {
    const config = loadCabinetConfig();
    setSelectedClientRef(client.ref);
    setData((prev) => ({
      ...prev,
      // Destinataire
      destinataireNom: client.dirigeant || client.raisonSociale,
      destinataireAdresse: client.adresse,
      destinataireCpVille: `${client.cp} ${client.ville}`,
      // Entite
      raisonSociale: client.raisonSociale,
      formeJuridique: client.forme,
      siren: client.siren,
      capital: String(client.capital || ""),
      adresse: client.adresse,
      cpVille: `${client.cp} ${client.ville}`,
      ape: client.ape,
      dirigeant: client.dirigeant,
      effectif: client.effectif,
      domaine: client.domaine,
      dateCreation: client.dateCreation,
      // LCB-FT
      nivVigilance: client.nivVigilance,
      scoreGlobal: client.scoreGlobal,
      ppe: client.ppe,
      paysRisque: client.paysRisque,
      be: client.be,
      // Mission
      missionPrincipale: client.mission,
      // Honoraires
      honorairesHT: String(client.honoraires || ""),
      frequencePaiement: client.frequence || "Mensuel",
      // Lieu
      lieuLettre: config.ville || "",
      lieuSignature: config.ville || "",
      // Social/Juridique detection
      missionSocial: client.mission === "SOCIAL / PAIE SEULE",
      missionJuridique: client.juridique > 0,
    }));
  }, []);

  const handleScrollToSection = useCallback((sectionId: string) => {
    setActiveSectionId(sectionId);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-xl font-bold">Lettre de Mission</h1>
        <p className="text-sm text-muted-foreground">
          Editeur, templates et historique des lettres de mission
        </p>
      </div>

      <Tabs defaultValue="editor" className="flex-1 flex flex-col px-6">
        <TabsList className="w-fit">
          <TabsTrigger value="editor" className="gap-2">
            <FileText className="h-4 w-4" />
            Nouvelle lettre
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuration cabinet
          </TabsTrigger>
        </TabsList>

        {/* Nouvelle lettre */}
        <TabsContent value="editor" className="flex-1 mt-0 flex flex-col overflow-hidden">
          {/* Client selector */}
          <div className="py-3 border-b border-white/[0.06]">
            <ClientSelector
              selectedRef={selectedClientRef}
              onSelect={handleClientSelect}
            />
          </div>

          {/* Split view: Editor (60%) | Preview (40%) */}
          <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
            <div className="lg:w-[60%] w-full overflow-y-auto border-r border-white/[0.06]">
              <LettreMissionEditor
                data={data}
                onChange={setData}
                onScrollToSection={handleScrollToSection}
              />
            </div>
            <div className="lg:w-[40%] w-full overflow-y-auto bg-slate-800/30 p-4">
              <LettreMissionPreviewV2
                data={data}
                activeSectionId={activeSectionId}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4 pb-6">
          <TemplateManager />
        </TabsContent>

        <TabsContent value="history" className="mt-4 pb-6">
          <LettreMissionHistory />
        </TabsContent>

        <TabsContent value="config" className="mt-4 pb-6">
          <CabinetConfigForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
