import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppState } from "@/lib/AppContext";
import {
  generateFromClient,
  getDefaultTemplate,
  renderToPdf,
  renderToDocx,
  validateLettreMission,
} from "@/lib/lettreMissionEngine";
import type { CabinetConfig, LettreMissionOptions } from "@/types/lettreMission";
import { DEFAULT_LM_OPTIONS } from "@/types/lettreMission";
import type { Client } from "@/lib/types";
import LettreMissionPreview from "@/components/lettre-mission/LettreMissionPreview";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Save,
  Mail,
  Copy,
  UserPlus,
  Check,
} from "lucide-react";

// ── Constants ──
const DEFAULT_CABINET: CabinetConfig = {
  nom: "Cabinet d'Expertise Comptable",
  adresse: "1 rue de la Paix",
  cp: "75001",
  ville: "Paris",
  siret: "000 000 000 00000",
  numeroOEC: "00-000000",
  email: "contact@cabinet.fr",
  telephone: "01 00 00 00 00",
  couleurPrimaire: "#1E3A5F",
  couleurSecondaire: "#3B82F6",
  police: "system-ui",
};

type LetterStatus = "brouillon" | "finalisee" | "envoyee";
type ViewTab = "editeur" | "apercu";

const STATUS_CONFIG: Record<LetterStatus, { label: string; className: string }> = {
  brouillon: { label: "Brouillon", className: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  finalisee: { label: "Finalisée", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  envoyee: { label: "Envoyée", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
};

const SECTIONS = [
  { id: 1, label: "Identification" },
  { id: 2, label: "Mission" },
  { id: 3, label: "Honoraires" },
  { id: 4, label: "Paiement" },
  { id: 5, label: "LCB-FT" },
  { id: 6, label: "KYC" },
  { id: 7, label: "Résiliation" },
  { id: 8, label: "RGPD" },
  { id: 9, label: "Signatures" },
  { id: 10, label: "Annexes" },
];

// ── Main Component ──
export default function LettreMissionPage() {
  const { ref } = useParams<{ ref: string }>();
  const navigate = useNavigate();
  const { clients } = useAppState();
  const contentRef = useRef<HTMLDivElement>(null);

  const [selectedRef, setSelectedRef] = useState<string>(ref ?? "");
  const [options, setOptions] = useState<LettreMissionOptions>(DEFAULT_LM_OPTIONS);
  const [activeTab, setActiveTab] = useState<ViewTab>("editeur");
  const [status, setStatus] = useState<LetterStatus>("brouillon");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const client = useMemo(
    () =>
      clients.find((c) => c.ref === selectedRef) ??
      (ref ? clients.find((c) => c.ref === ref) : undefined),
    [clients, selectedRef, ref]
  );

  const validation = useMemo(
    () => (client ? validateLettreMission(client, DEFAULT_CABINET) : null),
    [client]
  );

  const template = useMemo(() => getDefaultTemplate(), []);

  // Section completion status
  const sectionStatus = useMemo(() => {
    if (!client) return SECTIONS.map(() => "grey" as const);
    return SECTIONS.map((s) => {
      switch (s.id) {
        case 1: return client.raisonSociale && client.siren && client.dirigeant ? "green" : "orange";
        case 2: return client.mission && client.associe ? "green" : "orange";
        case 3: return client.honoraires > 0 ? "green" : "orange";
        case 4: return client.frequence ? "green" : "orange";
        case 5: return client.nivVigilance ? "green" : "orange";
        case 6: return client.siren ? "green" : "orange";
        case 7: return "green";
        case 8: return "green";
        case 9: return client.dirigeant && client.associe ? "green" : "orange";
        case 10: return client.iban ? "green" : "orange";
        default: return "grey";
      }
    });
  }, [client]);

  const completedCount = sectionStatus.filter((s) => s === "green").length;
  const progressPercent = Math.round((completedCount / SECTIONS.length) * 100);

  // ── Export handlers ──
  const handleExportPdf = useCallback(() => {
    if (!client) return;
    try {
      const lm = generateFromClient(client, DEFAULT_CABINET, options);
      renderToPdf(lm);
      toast.success("PDF généré avec succès");
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    }
  }, [client, options]);

  const handleExportDocx = useCallback(async () => {
    if (!client) return;
    try {
      const lm = generateFromClient(client, DEFAULT_CABINET, options);
      await renderToDocx(lm);
      toast.success("DOCX généré avec succès");
    } catch {
      toast.error("Erreur lors de la génération du DOCX");
    }
  }, [client, options]);

  const handleSave = useCallback(() => {
    setLastSaved(new Date());
    setStatus("finalisee");
    toast.success("Lettre sauvegardée");
  }, []);

  const handleEmail = useCallback(() => {
    setStatus("envoyee");
    toast.success("Email envoyé (simulation)");
  }, []);

  const handleDuplicate = useCallback(
    (targetRef: string) => {
      setSelectedRef(targetRef);
      setStatus("brouillon");
      setLastSaved(null);
      toast.success("Données remplacées par le nouveau client");
    },
    []
  );

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (mod && e.key === "p") {
        e.preventDefault();
        handleExportPdf();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, handleExportPdf]);

  // ── Section scroll ──
  const scrollToSection = useCallback((sectionId: number) => {
    const el = contentRef.current?.querySelector(`[data-section="${sectionId}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // ── Time since last save ──
  const timeSinceSave = useMemo(() => {
    if (!lastSaved) return null;
    const diff = Math.round((Date.now() - lastSaved.getTime()) / 60000);
    if (diff < 1) return "à l'instant";
    return `il y a ${diff} min`;
  }, [lastSaved]);

  const statusConf = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      {/* ═══ TOOLBAR — Sticky within outlet ═══ */}
      <div className="sticky top-0 z-20 bg-slate-900 border-b border-white/10 shrink-0">
        {/* Line 1: Back + Title + Status | Tab switcher + Export */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-slate-400 hover:text-white gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </Button>
            <h1 className="text-sm font-semibold text-white">Lettre de Mission</h1>
            <Badge variant="outline" className={`text-xs ${statusConf.className}`}>
              {statusConf.label}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switcher */}
            <div className="flex rounded-md border border-white/10 overflow-hidden">
              <button
                onClick={() => setActiveTab("editeur")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "editeur"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Éditeur
              </button>
              <button
                onClick={() => setActiveTab("apercu")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "apercu"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Aperçu
              </button>
            </div>

            <div className="w-px h-5 bg-white/10" />

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

        {/* Line 2: Client selector + Validation | Civilité */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Select value={selectedRef} onValueChange={setSelectedRef}>
              <SelectTrigger className="w-[320px] h-8 text-xs">
                <SelectValue placeholder="Sélectionner un client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.ref} value={c.ref}>
                    {c.ref} — {c.raisonSociale} — {c.siren}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-slate-400 hover:text-white gap-1 h-8"
              onClick={() => navigate("/nouveau-client")}
            >
              <UserPlus className="h-3.5 w-3.5" /> Nouveau
            </Button>

            {/* Duplicate button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-slate-400 hover:text-white gap-1 h-8"
                  disabled={!client}
                >
                  <Copy className="h-3.5 w-3.5" /> Dupliquer
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-60 overflow-auto">
                {clients
                  .filter((c) => c.ref !== selectedRef)
                  .map((c) => (
                    <DropdownMenuItem key={c.ref} onClick={() => handleDuplicate(c.ref)}>
                      {c.ref} — {c.raisonSociale}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {validation && (
              <Badge
                variant="outline"
                className={`text-xs h-6 ${
                  validation.valid
                    ? "border-emerald-500/30 text-emerald-400"
                    : "border-amber-500/30 text-amber-400"
                }`}
              >
                {validation.valid ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" /> Dossier complet</>
                ) : (
                  <><AlertTriangle className="w-3 h-3 mr-1" /> {validation.champsManquants.length} champ(s) manquant(s)</>
                )}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Civilité :</span>
            <div className="flex rounded-md border border-white/10 overflow-hidden">
              <button
                onClick={() => setOptions((o) => ({ ...o, genre: "M" }))}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  options.genre === "M"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Monsieur
              </button>
              <button
                onClick={() => setOptions((o) => ({ ...o, genre: "F" }))}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  options.genre === "F"
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Madame
              </button>
            </div>
          </div>
        </div>

        {/* Line 3: Save + Email + last saved | Progress (single instance) */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!client}
              className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-7"
            >
              <Save className="h-3.5 w-3.5" /> Sauvegarder
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEmail}
              disabled={!client}
              className="gap-1 text-xs h-7"
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </Button>
            {timeSinceSave && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-500" />
                Dernière sauvegarde : {timeSinceSave}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {completedCount}/{SECTIONS.length} sections — {progressPercent}%
            </span>
            <Progress value={progressPercent} className="w-32 h-1.5" />
          </div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div className="flex-1 overflow-hidden">
        {/* ── APERÇU MODE ── */}
        {activeTab === "apercu" && (
          <div className="h-full overflow-auto">
            {client ? (
              <LettreMissionPreview
                client={client}
                template={template}
                cabinetConfig={DEFAULT_CABINET}
                options={options}
              />
            ) : (
              <div className="text-center text-slate-500 py-20">
                Sélectionnez un client pour afficher l'aperçu
              </div>
            )}
          </div>
        )}

        {/* ── ÉDITEUR MODE ── */}
        {activeTab === "editeur" && (
          <div className="flex h-full">
            {/* Section nav sidebar — 32px wide, does NOT overlap content */}
            <div className="w-8 shrink-0 bg-slate-900/50 border-r border-white/[0.06] overflow-y-auto">
              <div className="flex flex-col items-center py-3 gap-1.5">
                {SECTIONS.map((s, i) => {
                  const st = sectionStatus[i];
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      title={s.label}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all hover:scale-110 ${
                        st === "green"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : st === "orange"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-slate-700/30 text-slate-500 border border-white/[0.06]"
                      }`}
                    >
                      {st === "green" ? "✓" : s.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section content — scrolls independently */}
            <div ref={contentRef} className="flex-1 overflow-y-auto p-6 space-y-4">
              {!client && (
                <div className="text-center text-slate-500 py-20">
                  Sélectionnez un client pour générer une lettre de mission
                </div>
              )}

              {client && (
                <>
                  {/* Section 1 — Identification */}
                  <SectionCard id={1} title="Identification du client" status={sectionStatus[0]}>
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                      <Field label="Raison sociale" value={client.raisonSociale} />
                      <Field label="Forme juridique" value={`${client.forme} — Capital : ${client.capital?.toLocaleString("fr-FR") ?? "N/C"} €`} />
                      <Field label="SIREN" value={client.siren} />
                      <Field label="Dirigeant" value={client.dirigeant} />
                      <Field label="Adresse" value={`${client.adresse}, ${client.cp} ${client.ville}`} />
                      <Field label="APE" value={`${client.ape} — ${client.domaine}`} />
                    </div>
                  </SectionCard>

                  {/* Section 2 — Mission */}
                  <SectionCard id={2} title="Nature de la mission" status={sectionStatus[1]}>
                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                      <Field label="Type" value={client.mission} />
                      <Field label="Associé signataire" value={client.associe} />
                      <Field label="Superviseur" value={client.superviseur} />
                      <Field label="Comptable" value={client.comptable} />
                      <Field label="Fréquence" value={client.frequence} />
                      <Field label="Effectif" value={client.effectif} />
                    </div>
                  </SectionCard>

                  {/* Section 3 — Honoraires */}
                  <SectionCard id={3} title="Honoraires" status={sectionStatus[2]}>
                    <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
                      <Field label="Comptable" value={`${client.honoraires?.toLocaleString("fr-FR")} €`} />
                      <Field label="Juridique" value={`${client.juridique?.toLocaleString("fr-FR")} €`} />
                      <div className="font-semibold text-white">
                        Total : {((client.honoraires ?? 0) + (client.reprise ?? 0) + (client.juridique ?? 0)).toLocaleString("fr-FR")} € HT
                      </div>
                    </div>
                  </SectionCard>

                  {/* Section 4 — Paiement */}
                  <SectionCard id={4} title="Modalités de paiement" status={sectionStatus[3]}>
                    <div className="text-sm text-slate-300 space-y-1">
                      <Field label="Fréquence" value={client.frequence} />
                      <Field label="IBAN" value={client.iban || "Non renseigné"} />
                      <Field label="BIC" value={client.bic || "Non renseigné"} />
                    </div>
                  </SectionCard>

                  {/* Section 5 — LCB-FT */}
                  <SectionCard id={5} title="Obligations LCB-FT" status={sectionStatus[4]}>
                    <div className="flex items-center gap-3 text-sm text-slate-300">
                      <Badge
                        variant="outline"
                        className={
                          client.nivVigilance === "SIMPLIFIEE" ? "border-green-500/50 text-green-400" :
                          client.nivVigilance === "RENFORCEE" ? "border-red-500/50 text-red-400" :
                          "border-amber-500/50 text-amber-400"
                        }
                      >
                        {client.nivVigilance}
                      </Badge>
                      <span>Score : {client.scoreGlobal}/100</span>
                      <span>PPE : {client.ppe}</span>
                      <span>Dernière revue : {client.dateDerniereRevue || "—"}</span>
                    </div>
                  </SectionCard>

                  {/* Section 6 — KYC */}
                  <SectionCard id={6} title="Pièces justificatives (KYC)" status={sectionStatus[5]}>
                    <div className="space-y-1.5 text-sm">
                      <KycCheck label="Pièce d'identité dirigeant" ok={client.dateExpCni ? new Date(client.dateExpCni) > new Date() : false} />
                      <KycCheck label="Extrait Kbis" ok={!!client.lienKbis} />
                      <KycCheck label="Statuts à jour" ok={!!client.lienStatuts} />
                      <KycCheck label="Bénéficiaires effectifs" ok={!!client.be} />
                    </div>
                  </SectionCard>

                  {/* Section 7 — Résiliation */}
                  <SectionCard id={7} title="Résiliation" status={sectionStatus[6]}>
                    <p className="text-sm text-slate-400">
                      Durée : 1 an, renouvelable par tacite reconduction. Préavis : 3 mois par LRAR.
                    </p>
                  </SectionCard>

                  {/* Section 8 — RGPD */}
                  <SectionCard id={8} title="Protection des données (RGPD)" status={sectionStatus[7]}>
                    <p className="text-sm text-slate-400">
                      Conformité RGPD (UE) 2016/679. Droits d'accès, rectification, effacement.
                    </p>
                  </SectionCard>

                  {/* Section 9 — Signatures */}
                  <SectionCard id={9} title="Signatures" status={sectionStatus[8]}>
                    <div className="grid grid-cols-2 gap-6 text-sm text-slate-300">
                      <div>
                        <div className="font-medium text-white mb-1">Pour le cabinet</div>
                        <div className="text-slate-400">{client.associe} — Associé signataire</div>
                      </div>
                      <div>
                        <div className="font-medium text-white mb-1">Pour le client</div>
                        <div className="text-slate-400">{client.dirigeant} — Gérant / Président</div>
                      </div>
                    </div>
                  </SectionCard>

                  {/* Section 10 — Annexes */}
                  <SectionCard id={10} title="Annexes (SEPA, Attestations)" status={sectionStatus[9]}>
                    <div className="text-sm text-slate-300 space-y-1.5">
                      <KycCheck label="Mandat SEPA" ok={!!client.iban} />
                      <KycCheck label="Attestation travail dissimulé" ok={true} />
                      <KycCheck label="Autorisation liasse fiscale" ok={true} />
                    </div>
                  </SectionCard>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function SectionCard({
  id,
  title,
  status,
  children,
}: {
  id: number;
  title: string;
  status: "green" | "orange" | "grey";
  children: React.ReactNode;
}) {
  return (
    <div
      data-section={id}
      className={`rounded-lg border p-4 ${
        status === "green"
          ? "bg-slate-800/30 border-emerald-500/10"
          : status === "orange"
          ? "bg-slate-800/30 border-amber-500/10"
          : "bg-slate-800/30 border-white/[0.06]"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
            status === "green"
              ? "bg-emerald-500/20 text-emerald-400"
              : status === "orange"
              ? "bg-amber-500/20 text-amber-400"
              : "bg-slate-700/30 text-slate-500"
          }`}
        >
          {status === "green" ? "✓" : id}
        </span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label} : </span>
      <span>{value}</span>
    </div>
  );
}

function KycCheck({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
          ok
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-slate-700/30 text-slate-500 border border-white/[0.06]"
        }`}
      >
        {ok && "✓"}
      </div>
      <span className={ok ? "text-slate-300" : "text-slate-500"}>{label}</span>
    </div>
  );
}
