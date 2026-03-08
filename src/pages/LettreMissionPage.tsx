import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import { supabase } from "@/integrations/supabase/client";
import type { Client } from "@/lib/types";
import {
  DEFAULT_TEMPLATE,
  replaceTemplateVariables,
  type TemplateSection,
} from "@/lib/lettreMissionTemplate";
import LettreMissionA4Preview from "@/components/lettre-mission/LettreMissionA4Preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  FileText,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Save,
  Eye,
  Lock,
} from "lucide-react";

// ── Cabinet config (from localStorage or defaults) ──
interface CabinetInfo {
  nom: string;
  adresse: string;
  cp: string;
  ville: string;
  siret: string;
  numeroOEC: string;
  email: string;
  telephone: string;
}

const DEFAULT_CABINET: CabinetInfo = {
  nom: "Cabinet d'Expertise Comptable",
  adresse: "1 rue de la Paix",
  cp: "75001",
  ville: "Paris",
  siret: "000 000 000 00000",
  numeroOEC: "00-000000",
  email: "contact@cabinet.fr",
  telephone: "01 00 00 00 00",
};

function loadCabinet(): CabinetInfo {
  try {
    const stored = localStorage.getItem("lcb-cabinet-config");
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_CABINET, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CABINET;
}

// ══════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════
export default function LettreMissionPage() {
  const navigate = useNavigate();
  const { clients } = useAppState();
  const cabinet = useMemo(() => loadCabinet(), []);

  // ── Template state ──
  const [template, setTemplate] = useState<TemplateSection[]>(DEFAULT_TEMPLATE);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  // ── Generate state ──
  const [selectedRef, setSelectedRef] = useState<string>("");
  const [genre, setGenre] = useState<"M" | "Mme">("M");
  const [missions, setMissions] = useState({
    sociale: false,
    juridique: false,
    fiscal: false,
  });
  const [honoraires, setHonoraires] = useState({
    comptable: 0,
    constitution: 0,
    juridique: 0,
    frequence: "MENSUEL" as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL",
  });
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // ── Collapsed sections (modèle tab) ──
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const client = useMemo(
    () => clients.find((c) => c.ref === selectedRef) ?? null,
    [clients, selectedRef]
  );

  // ── Load template from Supabase on mount ──
  useEffect(() => {
    async function loadTemplate() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setTemplateLoaded(true);
          return;
        }
        const { data } = await supabase
          .from("parametres")
          .select("valeur")
          .eq("user_id", user.id)
          .eq("cle", "modele_lettre_mission")
          .maybeSingle();
        if (data?.valeur) {
          setTemplate(data.valeur as unknown as TemplateSection[]);
        }
      } catch (err) {
        console.warn("[loadTemplate] Failed:", err);
      } finally {
        setTemplateLoaded(true);
      }
    }
    loadTemplate();
  }, []);

  // ── Auto-fill honoraires when client changes ──
  useEffect(() => {
    if (!client) return;
    setHonoraires({
      comptable: client.honoraires || 0,
      constitution: client.reprise || 0,
      juridique: client.juridique || 0,
      frequence:
        client.frequence?.toLowerCase() === "trimestriel"
          ? "TRIMESTRIEL"
          : client.frequence?.toLowerCase() === "annuel"
          ? "ANNUEL"
          : "MENSUEL",
    });
  }, [client]);

  // ── Save template to Supabase ──
  const handleSaveTemplate = useCallback(async () => {
    setTemplateSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Vous devez être connecté pour sauvegarder le modèle");
        return;
      }
      const { error } = await supabase.from("parametres").upsert(
        {
          user_id: user.id,
          cle: "modele_lettre_mission",
          valeur: template as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,cle" }
      );
      if (error) throw error;
      toast.success("Modèle sauvegardé");
    } catch (err) {
      console.error("[saveTemplate]", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setTemplateSaving(false);
    }
  }, [template]);

  const handleResetTemplate = useCallback(() => {
    setTemplate(DEFAULT_TEMPLATE);
    toast.success("Modèle réinitialisé");
  }, []);

  // ── Update a section's content ──
  const updateSectionContent = useCallback(
    (id: string, content: string) => {
      setTemplate((prev) =>
        prev.map((s) => (s.id === id ? { ...s, content } : s))
      );
    },
    []
  );

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Build variables for preview ──
  const previewVariables = useMemo(() => {
    if (!client) return {};
    const formule = genre === "Mme" ? "Madame" : "Monsieur";
    const now = new Date();
    return {
      formule_politesse: formule,
      dirigeant: client.dirigeant,
      raison_sociale: client.raisonSociale,
      forme_juridique: client.forme,
      adresse: client.adresse,
      code_postal: client.cp,
      ville: client.ville,
      siren: client.siren,
      frequence: client.frequence,
      date_du_jour: now.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      date_cloture: `31/12/${now.getFullYear()}`,
      associe: client.associe,
      nom_cabinet: cabinet.nom,
      ville_cabinet: cabinet.ville,
      iban: client.iban
        ? client.iban.replace(/(.{4})/g, "$1 ").trim()
        : "",
      bic: client.bic || "",
    } as Record<string, string>;
  }, [client, genre, cabinet]);

  // ── Export PDF ──
  const handleExportPdf = useCallback(async () => {
    if (!client) return;
    try {
      const { renderNewLettreMissionPdf } = await import(
        "@/lib/lettreMissionPdf"
      );
      renderNewLettreMissionPdf({
        sections: template,
        client,
        genre,
        missions,
        honoraires,
        cabinet,
        variables: previewVariables,
      });
      toast.success("PDF généré avec succès");
    } catch (err) {
      console.error("[PDF]", err);
      toast.error("Erreur lors de la génération du PDF");
    }
  }, [client, template, genre, missions, honoraires, cabinet, previewVariables]);

  // ── Export DOCX ──
  const handleExportDocx = useCallback(async () => {
    if (!client) return;
    try {
      const { renderNewLettreMissionDocx } = await import(
        "@/lib/lettreMissionDocx"
      );
      await renderNewLettreMissionDocx({
        sections: template,
        client,
        genre,
        missions,
        honoraires,
        cabinet,
        variables: previewVariables,
      });
      toast.success("DOCX généré avec succès");
    } catch (err) {
      console.error("[DOCX]", err);
      toast.error("Erreur lors de la génération du DOCX");
    }
  }, [client, template, genre, missions, honoraires, cabinet, previewVariables]);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      {/* ═══ TOOLBAR ═══ */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-slate-400 hover:text-white gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </Button>
            <h1 className="text-sm font-semibold text-white">
              Lettre de Mission
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPreviewModal(true)}
              disabled={!client}
              className="gap-1 text-xs"
            >
              <Eye className="h-3.5 w-3.5" /> Aperçu
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPdf}
              disabled={!client}
              className="gap-1 text-xs"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportDocx}
              disabled={!client}
              className="gap-1 text-xs"
            >
              <FileText className="h-3.5 w-3.5" /> DOCX
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 overflow-auto">
        <Tabs defaultValue="modele" className="h-full flex flex-col">
          <div className="px-4 pt-3 shrink-0">
            <TabsList className="bg-slate-800/50">
              <TabsTrigger value="modele">Modèle</TabsTrigger>
              <TabsTrigger value="generer">Générer</TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ ONGLET 1: MODÈLE ═══ */}
          <TabsContent value="modele" className="flex-1 overflow-auto px-4 pb-6">
            {/* Actions */}
            <div className="flex items-center gap-2 py-3 sticky top-0 z-10 bg-slate-900/95 backdrop-blur">
              <Button
                size="sm"
                onClick={handleSaveTemplate}
                disabled={templateSaving}
                className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Save className="h-3.5 w-3.5" />
                {templateSaving ? "Sauvegarde..." : "Sauvegarder le modèle"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetTemplate}
                className="gap-1 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
              </Button>
            </div>

            {/* Sections */}
            <div className="space-y-2">
              {template.map((section) => {
                const isCollapsed = collapsed[section.id] ?? true;
                return (
                  <div
                    key={section.id}
                    className="border border-white/10 rounded-lg overflow-hidden"
                  >
                    {/* Header */}
                    <button
                      onClick={() => toggleCollapse(section.id)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="text-sm font-medium text-slate-200">
                          {section.title}
                        </span>
                        {section.type === "conditional" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            {section.condition}
                          </span>
                        )}
                        {section.type === "annexe" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            annexe
                          </span>
                        )}
                      </div>
                      {!section.editable && (
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>

                    {/* Body */}
                    {!isCollapsed && (
                      <div className="px-4 py-3 border-t border-white/[0.06]">
                        {!section.editable ? (
                          <div>
                            <div className="text-xs text-amber-400/80 mb-2 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              Ce contenu est généré automatiquement
                            </div>
                            <div className="text-sm text-slate-400 bg-slate-800/30 rounded p-3 whitespace-pre-wrap font-mono">
                              {section.content}
                            </div>
                          </div>
                        ) : (
                          <textarea
                            value={section.content}
                            onChange={(e) =>
                              updateSectionContent(section.id, e.target.value)
                            }
                            className="w-full rounded-md border border-white/10 p-3 focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-y"
                            style={{
                              fontSize: 15,
                              color: "#e2e8f0",
                              backgroundColor: "hsl(217 33% 14%)",
                              minHeight: 100,
                              lineHeight: 1.6,
                              fontFamily: "inherit",
                            }}
                            rows={
                              Math.min(
                                20,
                                Math.max(4, section.content.split("\n").length + 1)
                              )
                            }
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* ═══ ONGLET 2: GÉNÉRER ═══ */}
          <TabsContent value="generer" className="flex-1 overflow-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-full">
              {/* Left panel — Config */}
              <div className="overflow-auto border-r border-white/10 p-4 space-y-4">
                {/* Client selector */}
                <div>
                  <Label className="text-xs text-slate-400 mb-1.5 block">
                    Sélectionner un client
                  </Label>
                  <select
                    value={selectedRef}
                    onChange={(e) => setSelectedRef(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  >
                    <option value="">-- Choisir un client --</option>
                    {clients.map((c) => (
                      <option key={c.ref} value={c.ref}>
                        {c.raisonSociale} ({c.ref})
                      </option>
                    ))}
                  </select>
                </div>

                {client && (
                  <>
                    {/* Client info card */}
                    <div className="border border-white/10 rounded-lg p-4">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Informations client
                      </h3>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        {[
                          ["Raison sociale", client.raisonSociale],
                          ["Forme", client.forme],
                          ["SIREN", client.siren],
                          ["Dirigeant", client.dirigeant],
                          ["Adresse", `${client.adresse}, ${client.cp} ${client.ville}`],
                          ["Associé", client.associe],
                          ["Vigilance", client.nivVigilance],
                          ["Score LCB-FT", `${client.scoreGlobal}/100`],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span className="text-slate-500 text-xs">{label}</span>
                            <div className="text-slate-200 truncate">{value || "—"}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Genre */}
                    <div>
                      <Label className="text-xs text-slate-400 mb-1.5 block">
                        Formule de politesse
                      </Label>
                      <select
                        value={genre}
                        onChange={(e) => setGenre(e.target.value as "M" | "Mme")}
                        className="w-full rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="M">M. (Monsieur)</option>
                        <option value="Mme">Mme (Madame)</option>
                      </select>
                    </div>

                    {/* Missions toggles */}
                    <div className="border border-white/10 rounded-lg p-4 space-y-3">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Missions complémentaires
                      </h3>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-slate-300">
                          Mission sociale
                        </Label>
                        <Switch
                          checked={missions.sociale}
                          onCheckedChange={(v) =>
                            setMissions((p) => ({ ...p, sociale: v }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-slate-300">
                          Mission juridique
                        </Label>
                        <Switch
                          checked={missions.juridique}
                          onCheckedChange={(v) =>
                            setMissions((p) => ({ ...p, juridique: v }))
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-slate-300">
                          Contrôle fiscal
                        </Label>
                        <Switch
                          checked={missions.fiscal}
                          onCheckedChange={(v) =>
                            setMissions((p) => ({ ...p, fiscal: v }))
                          }
                        />
                      </div>
                    </div>

                    {/* Honoraires */}
                    <div className="border border-white/10 rounded-lg p-4 space-y-3">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Honoraires
                      </h3>
                      <div>
                        <Label className="text-xs text-slate-500">
                          Forfait comptable annuel (€ HT)
                        </Label>
                        <input
                          type="number"
                          value={honoraires.comptable}
                          onChange={(e) =>
                            setHonoraires((p) => ({
                              ...p,
                              comptable: Number(e.target.value),
                            }))
                          }
                          className="w-full mt-1 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">
                          Constitution / Reprise dossier (€ HT)
                        </Label>
                        <input
                          type="number"
                          value={honoraires.constitution}
                          onChange={(e) =>
                            setHonoraires((p) => ({
                              ...p,
                              constitution: Number(e.target.value),
                            }))
                          }
                          className="w-full mt-1 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">
                          Juridique annuel (€ HT)
                        </Label>
                        <input
                          type="number"
                          value={honoraires.juridique}
                          onChange={(e) =>
                            setHonoraires((p) => ({
                              ...p,
                              juridique: Number(e.target.value),
                            }))
                          }
                          className="w-full mt-1 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">
                          Fréquence de facturation
                        </Label>
                        <select
                          value={honoraires.frequence}
                          onChange={(e) =>
                            setHonoraires((p) => ({
                              ...p,
                              frequence: e.target.value as
                                | "MENSUEL"
                                | "TRIMESTRIEL"
                                | "ANNUEL",
                            }))
                          }
                          className="w-full mt-1 rounded-md border border-white/10 bg-slate-800 text-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="MENSUEL">Mensuel</option>
                          <option value="TRIMESTRIEL">Trimestriel</option>
                          <option value="ANNUEL">Annuel</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right panel — Live preview */}
              <div className="overflow-auto bg-slate-950/50">
                {client ? (
                  <LettreMissionA4Preview
                    sections={template}
                    client={client}
                    genre={genre}
                    missions={missions}
                    honoraires={honoraires}
                    cabinet={cabinet}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                    Sélectionnez un client pour prévisualiser la lettre
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══ FULLSCREEN PREVIEW MODAL ═══ */}
      {showPreviewModal && client && (
        <div className="fixed inset-0 z-50 bg-black/80 overflow-auto">
          <div className="sticky top-0 z-10 flex justify-end p-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPreviewModal(false)}
              className="bg-slate-900/90 text-white"
            >
              Fermer
            </Button>
          </div>
          <LettreMissionA4Preview
            sections={template}
            client={client}
            genre={genre}
            missions={missions}
            honoraires={honoraires}
            cabinet={cabinet}
          />
        </div>
      )}
    </div>
  );
}
