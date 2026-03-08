import { useState, useMemo, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Lock,
  Building2,
  Scale,
  Search,
  FileText,
  CreditCard,
  ScrollText,
  BookOpen,
  ClipboardCheck,
  Pencil,
} from "lucide-react";
import type { Client, VigilanceLevel } from "../../lib/types";
import {
  LETTRE_MISSION_CONTENT,
  CONTROLE_FISCAL_OPTIONS,
  getFormulePolitesse,
  type Genre,
  type ControleFiscalOption,
} from "../../lib/lettreMissionContent";
import { LCBFT_TEMPLATES } from "../../lib/lcbftTemplates";
import paramO90 from "../../../param_o90.json";
import RepartitionTravaux from "./RepartitionTravaux";
import AttestationTravailDissimule from "./AttestationTravailDissimule";
import MandatSepa from "./MandatSepa";
import AutorisationLiasse from "./AutorisationLiasse";
import ConditionsGenerales from "./ConditionsGenerales";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorSection {
  id: string;
  title: string;
  visible: boolean;
  content: string;
  editable: boolean;
}

export interface MissionsToggleState {
  sociale: boolean;
  juridique: boolean;
  controleFiscal: boolean;
  controleFiscalOption: "A" | "B" | "RENONCE" | null;
}

export interface HonorairesValues {
  honoraires: number;
  setup: number;
  honoraires_juridique: number;
  frequence: string;
}

export interface EditorState {
  genre: Genre;
  sections: EditorSection[];
  missions: MissionsToggleState;
  honoraires: HonorairesValues;
}

export function buildDefaultEditorState(client?: Client | null): EditorState {
  const sections: EditorSection[] = Object.entries(LETTRE_MISSION_CONTENT).map(([key, sec]) => ({
    id: sec?.id ?? key,
    title: sec?.titre ?? key,
    visible: sec?.obligatoire || false,
    content: sec?.contenu ?? "",
    editable: true,
  }));

  const extraSections: EditorSection[] = [
    { id: "nature", title: "Nature et limites", visible: true, content: "", editable: false },
    { id: "paiement", title: "Modalités de paiement", visible: true, content: "Les honoraires sont payables selon la fréquence convenue, par prélèvement SEPA ou virement bancaire.\n\nEn cas de retard de paiement, des pénalités de retard seront appliquées conformément à l'article L.441-10 du Code de commerce.", editable: true },
    { id: "conclusion", title: "Conclusion", visible: true, content: "", editable: false },
    { id: "annexes", title: "Annexes", visible: true, content: "", editable: false },
  ];
  for (const extra of extraSections) {
    if (!sections.find((s) => s.id === extra.id)) {
      sections.push(extra);
    }
  }

  return {
    genre: "M",
    sections,
    missions: { sociale: false, juridique: false, controleFiscal: false, controleFiscalOption: null },
    honoraires: {
      honoraires: client?.honoraires ?? 0,
      setup: client?.reprise ?? 0,
      honoraires_juridique: client?.juridique ?? 0,
      frequence: "mensuel",
    },
  };
}

export interface MissionsConfig {
  sociale: boolean;
  juridique: boolean;
  controleFiscal: boolean;
  controleFiscalOption: ControleFiscalOption["id"];
}

interface HonorairesEditable {
  honoraires: number;
  setup: number;
  honorairesJuridique: number;
}

export interface LettreMissionEditorProps {
  client: Client | null;
  genre: Genre;
  onGenreChange?: (g: Genre) => void;
  onMissionsChange?: (m: MissionsConfig) => void;
  onStateChange?: (state: EditorState) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format ISO date "2005-03-15" → "15/03/2005" */
function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateStr;
}

/** Replace {{variable}} placeholders with their values */
function resolveText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (full, name) => vars[name] ?? full);
}

type SectionStatus = "complete" | "warning" | "disabled" | "empty";

function getSectionStatus(content: string | undefined, disabled?: boolean): SectionStatus {
  if (disabled) return "disabled";
  if (!content?.trim()) return "empty";
  if (/\{\{[a-z_]+\}\}/.test(content)) return "warning";
  return "complete";
}

const lmLab = paramO90.lm_lab as Record<string, { titre: string; corps: string }>;

function buildVariables(
  client: Client,
  genre: Genre,
  honoraires: HonorairesEditable,
): Record<string, string> {
  const fp = getFormulePolitesse(genre);
  const vigLevel = client.nivVigilance || "STANDARD";
  return {
    formule_politesse: fp,
    formule_politesse_fin: fp,
    dirigeant: client.dirigeant || "",
    raison_sociale: client.raisonSociale || "",
    forme_juridique: client.forme || "",
    domaine: client.domaine || "",
    ape: client.ape || "",
    siren: client.siren || "",
    capital: client.capital != null && client.capital > 0
      ? `${client.capital.toLocaleString("fr-FR")} €`
      : client.capital === 0 && (client.forme === "ENTREPRISE INDIVIDUELLE" || client.typePersonne === "physique")
        ? "N/A (entreprise individuelle)"
        : client.capital === 0
          ? "0 €"
          : "Non renseigné",
    date_creation: formatDateFR(client.dateCreation || ""),
    associe: client.associe || "",
    effectif: client.effectif || "",
    mission: client.mission || "",
    frequence: client.frequence || "",
    exercice_debut: "01/01/" + new Date().getFullYear(),
    exercice_fin: "31/12/" + new Date().getFullYear(),
    honoraires: `${honoraires.honoraires.toLocaleString("fr-FR")} €`,
    setup: honoraires.setup ? `${honoraires.setup.toLocaleString("fr-FR")} €` : "—",
    honoraires_juridique: `${honoraires.honorairesJuridique.toLocaleString("fr-FR")} €`,
    score_global: String(client.scoreGlobal ?? 0),
    niv_vigilance: vigLevel,
    ppe: client.ppe || "NON",
    date_revue: client.dateDerniereRevue ? formatDateFR(client.dateDerniereRevue) : "—",
    date_butoir: client.dateButoir ? formatDateFR(client.dateButoir) : "—",
    bloc_vigilance_lab: lmLab[vigLevel]?.corps || LCBFT_TEMPLATES[vigLevel as VigilanceLevel]?.corps || "",
  };
}

function getScoreColor(score: number): string {
  if (score <= 25) return "text-green-600";
  if (score <= 60) return "text-amber-500";
  return "text-red-600";
}

function getScoreBg(score: number): string {
  if (score <= 25) return "bg-green-100";
  if (score <= 60) return "bg-amber-100";
  return "bg-red-100";
}

function getScoreBorder(score: number): string {
  if (score <= 25) return "border-green-300";
  if (score <= 60) return "border-amber-300";
  return "border-red-300";
}

function getVigilanceBadge(level: VigilanceLevel) {
  const cfg = {
    SIMPLIFIEE: { bg: "bg-green-100 text-green-800 border-green-300", label: "Simplifiée" },
    STANDARD: { bg: "bg-amber-100 text-amber-800 border-amber-300", label: "Standard" },
    RENFORCEE: { bg: "bg-red-100 text-red-800 border-red-300", label: "Renforcée" },
  }[level] ?? { bg: "bg-gray-100 text-gray-800 border-gray-300", label: level };
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-bold border ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

// Textarea common styling — inline style guarantees visibility regardless of dark/light theme
const TEXTAREA_CLS = "w-full rounded-lg focus:outline-none resize-y";
const TEXTAREA_STYLE: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: "15px",
  lineHeight: "1.7",
  backgroundColor: "hsl(217, 33%, 14%)",
  border: "1px solid hsl(217, 33%, 25%)",
  padding: "16px",
  borderRadius: "8px",
  minHeight: "120px",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STATUS_DOT: Record<SectionStatus, React.ReactNode> = {
  complete: <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" title="Complet" />,
  warning: <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0 animate-pulse" title="Variables non résolues" />,
  disabled: <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" title="Désactivée" />,
  empty: <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" title="Vide" />,
};

function Section({
  id,
  titre,
  children,
  defaultOpen = true,
  icon,
  accentBorder,
  disabled,
  status,
}: {
  id: string;
  titre: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  accentBorder?: string;
  disabled?: boolean;
  status?: SectionStatus;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const effectiveStatus = status ?? (disabled ? "disabled" : undefined);
  return (
    <div
      id={`section-${id}`}
      data-section={id === "introduction" ? 1 : id === "entite" ? 2 : id === "lcbft" ? 3 : id === "mission" ? 4 : id === "duree" ? 5 : id === "mission_sociale" || id === "mission_juridique" || id === "mission_controle_fiscal" ? 6 : id === "honoraires" ? 7 : id === "signature" ? 9 : undefined}
      className={`border border-slate-700 rounded-lg shadow-sm ${accentBorder ?? ""} ${
        disabled ? "bg-slate-800/50 opacity-60" : "bg-slate-800"
      }`}
    >
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
          disabled ? "cursor-not-allowed" : "hover:bg-slate-700/50"
        }`}
      >
        {open && !disabled ? (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
        {icon}
        <span className="text-sm font-semibold text-slate-200">{titre}</span>
        <span className="ml-auto flex items-center gap-2">
          {effectiveStatus && STATUS_DOT[effectiveStatus]}
          {disabled && !status && (
            <span className="text-xs text-slate-500">Désactivée</span>
          )}
        </span>
      </button>
      {open && !disabled && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function EntityRow({
  label,
  value,
  onChange,
  even,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  even: boolean;
}) {
  const empty = !value?.trim();
  return (
    <tr className={even ? "bg-slate-700/30" : ""}>
      <td className="py-2 px-3 text-sm font-medium text-slate-400 w-1/3 border-r border-slate-600">
        {label}
      </td>
      <td className="py-1 px-2">
        <div className="relative">
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-2 py-1.5 text-sm rounded border bg-slate-900 text-slate-200 ${
              empty
                ? "border-orange-400 focus:ring-orange-400"
                : "border-slate-600 focus:ring-blue-500"
            } focus:ring-1 focus:outline-none`}
          />
          {empty && (
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2"
              title="À compléter"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function LettreMissionEditor({
  client,
  genre,
  onGenreChange,
  onMissionsChange,
  onStateChange,
}: LettreMissionEditorProps) {
  // Guard: no client selected
  if (!client) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Sélectionnez un client pour commencer la lettre de mission.
      </div>
    );
  }

  // --- Original templates (with {{variables}}) ---
  const templates = useMemo(() => {
    const t: Record<string, string> = {};
    for (const [key, sec] of Object.entries(LETTRE_MISSION_CONTENT)) {
      if (sec && sec.contenu) {
        t[key] = sec.contenu;
      }
    }
    return t;
  }, []);

  // --- State ---
  const [honoraires, setHonoraires] = useState<HonorairesEditable>({
    honoraires: client.honoraires || 0,
    setup: client.reprise || 0,
    honorairesJuridique: client.juridique || 0,
  });

  // Build variables (needed for initial section resolution)
  const vars = useMemo(
    () => buildVariables(client, genre, honoraires),
    [client, genre, honoraires],
  );

  // Track which sections user manually edited
  const [userEdited, setUserEdited] = useState<Record<string, boolean>>({});

  // Sections state: initialized with resolved text
  const [sections, setSections] = useState(() => {
    const initVars = buildVariables(client, genre, {
      honoraires: client.honoraires || 0,
      setup: client.reprise || 0,
      honorairesJuridique: client.juridique || 0,
    });
    const s: Record<string, string> = {};
    for (const [key, sec] of Object.entries(LETTRE_MISSION_CONTENT)) {
      if (sec && sec.contenu) {
        s[key] = resolveText(sec.contenu, initVars);
      }
    }
    return s;
  });

  // Re-resolve non-edited sections when variables change
  useEffect(() => {
    setSections((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [key, template] of Object.entries(templates)) {
        if (!userEdited[key]) {
          const resolved = resolveText(template, vars);
          if (next[key] !== resolved) {
            next[key] = resolved;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [vars, templates, userEdited]);

  const [entity, setEntity] = useState(() => ({
    raison_sociale: client.raisonSociale || "",
    forme_juridique: client.forme || "",
    dirigeant: client.dirigeant || "",
    domaine: client.domaine || "",
    ape: client.ape || "",
    siren: client.siren || "",
    capital: client.capital != null && client.capital > 0
      ? String(client.capital)
      : client.capital === 0 && (client.forme === "ENTREPRISE INDIVIDUELLE" || client.typePersonne === "physique")
        ? "N/A (EI)"
        : client.capital === 0 ? "0" : "Non renseigné",
    date_creation: formatDateFR(client.dateCreation || ""),
    date_cloture: "31/12",
    associe: client.associe || "",
    effectif: client.effectif || "",
    mission: (client.mission as string) || "",
    frequence: client.frequence || "",
    telephone: client.tel || "",
    email: client.mail || "",
  }));

  const [missions, setMissions] = useState<MissionsConfig>({
    sociale: false,
    juridique: false,
    controleFiscal: false,
    controleFiscalOption: "A",
  });

  const [missionEditable, setMissionEditable] = useState(false);

  // Reset all internal state when client changes
  useEffect(() => {
    if (!client) return;
    const initVars = buildVariables(client, genre, {
      honoraires: client.honoraires || 0,
      setup: client.reprise || 0,
      honorairesJuridique: client.juridique || 0,
    });
    const s: Record<string, string> = {};
    for (const [key, sec] of Object.entries(LETTRE_MISSION_CONTENT)) {
      if (sec && sec.contenu) {
        s[key] = resolveText(sec.contenu, initVars);
      }
    }
    setSections(s);
    setHonoraires({
      honoraires: client.honoraires || 0,
      setup: client.reprise || 0,
      honorairesJuridique: client.juridique || 0,
    });
    setEntity({
      raison_sociale: client.raisonSociale || "",
      forme_juridique: client.forme || "",
      dirigeant: client.dirigeant || "",
      domaine: client.domaine || "",
      ape: client.ape || "",
      siren: client.siren || "",
      capital: client.capital != null && client.capital > 0
        ? String(client.capital)
        : client.capital === 0 && (client.forme === "ENTREPRISE INDIVIDUELLE" || client.typePersonne === "physique")
          ? "N/A (EI)"
          : client.capital === 0 ? "0" : "Non renseigné",
      date_creation: formatDateFR(client.dateCreation || ""),
      date_cloture: "31/12",
      associe: client.associe || "",
      effectif: client.effectif || "",
      mission: (client.mission as string) || "",
      frequence: client.frequence || "",
      telephone: client.tel || "",
      email: client.mail || "",
    });
    setMissions({ sociale: false, juridique: false, controleFiscal: false, controleFiscalOption: "A" });
    setUserEdited({});
    setMissionEditable(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.ref]);

  // Sync state to parent for preview
  useEffect(() => {
    if (!onStateChange) return;
    const editorSections: EditorSection[] = Object.entries(sections).map(([key, content]) => {
      const meta = LETTRE_MISSION_CONTENT[key];
      return {
        id: meta?.id ?? key,
        title: meta?.titre ?? key,
        visible: key === "missionSociale" ? missions.sociale
          : key === "missionJuridique" ? missions.juridique
          : key === "missionControleFiscal" ? missions.controleFiscal
          : true,
        content,
        editable: true,
      };
    });
    const implicitSections: EditorSection[] = [
      { id: "nature", title: "Nature et limites", visible: true, content: "", editable: false },
      { id: "paiement", title: "Modalités de paiement", visible: true, content: "Les honoraires sont payables selon la fréquence convenue, par prélèvement SEPA ou virement bancaire.\n\nEn cas de retard de paiement, des pénalités de retard seront appliquées conformément à l'article L.441-10 du Code de commerce.", editable: false },
      { id: "conclusion", title: "Conclusion", visible: true, content: "", editable: false },
      { id: "annexes", title: "Annexes", visible: true, content: "", editable: false },
    ];
    for (const extra of implicitSections) {
      if (!editorSections.find((s) => s.id === extra.id)) {
        editorSections.push(extra);
      }
    }
    onStateChange({
      genre,
      sections: editorSections,
      missions: {
        sociale: missions.sociale,
        juridique: missions.juridique,
        controleFiscal: missions.controleFiscal,
        controleFiscalOption: missions.controleFiscalOption === "A" || missions.controleFiscalOption === "B" || missions.controleFiscalOption === "RENONCE"
          ? missions.controleFiscalOption
          : null,
      },
      honoraires: {
        honoraires: honoraires.honoraires,
        setup: honoraires.setup,
        honoraires_juridique: honoraires.honorairesJuridique,
        frequence: (entity.frequence || "").toLowerCase().includes("trimestr") ? "trimestriel" : "mensuel",
      },
    });
  }, [sections, missions, honoraires, genre, entity.frequence, onStateChange]);
  const [annexeTab, setAnnexeTab] = useState<string>("repartition");

  // --- Derived ---
  const freq = (client.frequence || "MENSUEL").toUpperCase();
  const periodeLabel = freq.includes("TRIMESTR") ? "trimestre" : "mois";
  const diviseur = freq.includes("TRIMESTR") ? 4 : 12;
  const montantPeriodique = useMemo(
    () =>
      (honoraires.honoraires / diviseur).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [honoraires.honoraires, diviseur],
  );

  function toggleMission(key: keyof Omit<MissionsConfig, "controleFiscalOption">) {
    const next = { ...missions, [key]: !missions[key] };
    setMissions(next);
    onMissionsChange?.(next);
  }

  function updateSection(key: string, val: string) {
    setSections((s) => ({ ...s, [key]: val }));
    setUserEdited((e) => ({ ...e, [key]: true }));
  }

  const entityFields = [
    { key: "raison_sociale" as const, label: "Raison sociale" },
    { key: "forme_juridique" as const, label: "Forme juridique" },
    { key: "dirigeant" as const, label: "Dirigeant / Représentant légal" },
    { key: "domaine" as const, label: "Objet social / Activité" },
    { key: "ape" as const, label: "Code APE" },
    { key: "siren" as const, label: "SIREN" },
    { key: "capital" as const, label: "Capital social" },
    { key: "date_creation" as const, label: "Date de création" },
    { key: "date_cloture" as const, label: "Date de clôture" },
    { key: "associe" as const, label: "EC responsable" },
    { key: "effectif" as const, label: "Effectif du personnel" },
    { key: "telephone" as const, label: "Téléphone" },
    { key: "email" as const, label: "Email" },
    { key: "mission" as const, label: "Type de mission" },
    { key: "frequence" as const, label: "Périodicité" },
  ];

  const ANNEXE_TABS = [
    { id: "repartition", label: "Répartition travaux", icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
    { id: "dissimule", label: "Travail dissimulé", icon: <ScrollText className="h-3.5 w-3.5" /> },
    { id: "sepa", label: "SEPA", icon: <CreditCard className="h-3.5 w-3.5" /> },
    { id: "liasse", label: "Liasse fiscale", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "cgv", label: "CGV", icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  const scoreGlobal = client.scoreGlobal ?? 0;
  const nivVigilance = client.nivVigilance || "STANDARD";
  const vigilanceLmLab = lmLab[nivVigilance];

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* SECTION 1 — INTRODUCTION                                     */}
      {/* ============================================================ */}
      <Section
        id="introduction"
        titre={LETTRE_MISSION_CONTENT.introduction?.titre ?? "Introduction"}
        status={getSectionStatus(sections.introduction)}
      >
        <textarea
          value={sections.introduction ?? ""}
          onChange={(e) => updateSection("introduction", e.target.value)}
          rows={6}
          className={TEXTAREA_CLS}
          style={TEXTAREA_STYLE}
        />
      </Section>

      {/* ============================================================ */}
      {/* SECTION 2 — VOTRE ENTITÉ (tableau éditable)                  */}
      {/* ============================================================ */}
      <Section
        id="entite"
        titre={LETTRE_MISSION_CONTENT.entite?.titre ?? "VOTRE ENTITÉ"}
        status={getSectionStatus(Object.values(entity).join(" "))}
      >
        <table className="w-full border-collapse border border-slate-600 rounded overflow-hidden">
          <thead>
            <tr className="bg-slate-700">
              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-300 uppercase tracking-wide border-r border-slate-600 w-1/3">
                Champ
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Valeur
              </th>
            </tr>
          </thead>
          <tbody>
            {entityFields.map((f, i) => (
              <EntityRow
                key={f.key}
                label={f.label}
                value={entity[f.key] ?? ""}
                onChange={(v) => setEntity((prev) => ({ ...prev, [f.key]: v }))}
                even={i % 2 === 0}
              />
            ))}
          </tbody>
        </table>
      </Section>

      {/* ============================================================ */}
      {/* SECTION 3 — LCB-FT (bloc visuel)                            */}
      {/* ============================================================ */}
      <Section
        id="lcbft"
        titre={LETTRE_MISSION_CONTENT.lcbft?.titre ?? "OBLIGATIONS DE VIGILANCE – LCB-FT"}
        icon={<Lock className="h-4 w-4 text-[#1a1a2e]" />}
        accentBorder="border-l-4 border-l-[#1a1a2e]"
        status="complete"
      >
        {LETTRE_MISSION_CONTENT.lcbft?.soustitre && (
          <p className="text-xs text-slate-400 mb-3 -mt-1">
            {LETTRE_MISSION_CONTENT.lcbft.soustitre}
          </p>
        )}

        {/* Score en grand format + Badge vigilance */}
        <div className={`rounded-xl p-5 mb-4 border-2 ${getScoreBorder(scoreGlobal)} ${getScoreBg(scoreGlobal)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <span
                  className={`text-[48px] font-black leading-none ${getScoreColor(scoreGlobal)}`}
                >
                  {scoreGlobal}
                </span>
                <div className="text-xs text-gray-500 font-medium mt-1">/ 100</div>
              </div>
              <div className="border-l border-gray-300 pl-4 space-y-2">
                {getVigilanceBadge(nivVigilance)}
                <div className="text-xs text-gray-500">Niveau de vigilance</div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-28 text-right">Statut PPE</span>
                <span
                  className={`font-semibold ${
                    client.ppe === "OUI" ? "text-red-600" : "text-gray-700"
                  }`}
                >
                  {client.ppe || "NON"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-28 text-right">Dernière KYC</span>
                <span className="text-gray-700">
                  {client.dateDerniereRevue ? formatDateFR(client.dateDerniereRevue) : "—"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-28 text-right">Prochaine KYC</span>
                <span className="text-gray-700">
                  {client.dateButoir ? formatDateFR(client.dateButoir) : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bloc vigilance dynamique — texte adapté depuis param_o90.json > lm_lab */}
        {vigilanceLmLab && (
          <div
            className={`rounded-lg p-4 mb-3 text-sm leading-relaxed border ${getScoreBorder(scoreGlobal)} ${getScoreBg(scoreGlobal)}`}
          >
            <p className="font-bold text-slate-200 mb-2">
              {vigilanceLmLab.titre}
            </p>
            <p className="text-slate-300 whitespace-pre-line text-[13px] leading-relaxed">
              {vigilanceLmLab.corps}
            </p>
          </div>
        )}

        {/* Engagements + Conservation */}
        <div className="space-y-2 text-xs text-slate-400 leading-relaxed">
          <p>
            <strong>Engagements contractuels du client :</strong>{" "}
            Le client reconnaît avoir été informé des obligations de vigilance
            qui s'appliquent au cabinet en sa qualité de professionnel assujetti.
            Il s'engage à répondre sans délai à toute demande de justificatif
            émanant du cabinet dans ce cadre. Le non-respect de cet engagement
            constitue une cause légitime de suspension ou de résiliation de la
            mission, sans indemnité (art. L.561-8 CMF).
          </p>
          <p>
            <strong>Durée de conservation LCB-FT :</strong>{" "}
            Conformément à l'art. L.561-12 CMF, l'ensemble des pièces
            d'identification est conservé pendant cinq (5) ans à compter de la
            fin de la relation d'affaires, indépendamment des délais comptables.
          </p>
        </div>
      </Section>

      {/* ============================================================ */}
      {/* SECTION 4 — NOTRE MISSION (lecture seule + Personnaliser)     */}
      {/* ============================================================ */}
      <Section
        id="mission"
        titre={LETTRE_MISSION_CONTENT.mission?.titre ?? "Notre mission"}
        status={getSectionStatus(sections.mission)}
      >
        <div className="relative">
          <textarea
            value={sections.mission ?? ""}
            onChange={(e) => updateSection("mission", e.target.value)}
            readOnly={!missionEditable}
            rows={10}
            className={`${TEXTAREA_CLS} ${
              missionEditable
                ? ""
                : "cursor-default"
            }`}
            style={{
              ...TEXTAREA_STYLE,
              ...(missionEditable ? {} : { backgroundColor: "hsl(217, 33%, 12%)", color: "#94a3b8" }),
            }}
            style={TEXTAREA_STYLE}
          />
          {!missionEditable && (
            <button
              type="button"
              onClick={() => setMissionEditable(true)}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded shadow-sm text-blue-400 hover:bg-slate-600 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Personnaliser
            </button>
          )}
        </div>
      </Section>

      {/* ============================================================ */}
      {/* SECTION 5 — DURÉE DE LA MISSION                              */}
      {/* ============================================================ */}
      <Section
        id="duree"
        titre={LETTRE_MISSION_CONTENT.duree?.titre ?? "Durée de la mission"}
        status={getSectionStatus(sections.duree)}
      >
        <textarea
          value={sections.duree ?? ""}
          onChange={(e) => updateSection("duree", e.target.value)}
          rows={4}
          className={TEXTAREA_CLS}
          style={TEXTAREA_STYLE}
        />
      </Section>

      {/* ============================================================ */}
      {/* SECTION 6 — MISSIONS COMPLÉMENTAIRES (toggles)               */}
      {/* ============================================================ */}
      <div className="border border-slate-700 rounded-lg bg-slate-800 shadow-sm p-4" data-section="6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">
          Missions complémentaires
        </h3>
        <div className="space-y-4">
          {/* Sociale */}
          <MissionToggle
            icon={<Building2 className="h-4 w-4" />}
            label="Mission sociale"
            active={missions.sociale}
            onToggle={() => toggleMission("sociale")}
          />
          {missions.sociale ? (
            <div className="ml-8 animate-slideDown">
              <Section
                id="mission_sociale"
                titre={LETTRE_MISSION_CONTENT.missionSociale?.titre ?? "Mission sociale"}
                defaultOpen
                status={getSectionStatus(sections.missionSociale)}
              >
                <textarea
                  value={sections.missionSociale ?? ""}
                  onChange={(e) => updateSection("missionSociale", e.target.value)}
                  rows={8}
                  className={TEXTAREA_CLS}
                  style={TEXTAREA_STYLE}
                />
              </Section>
            </div>
          ) : (
            <Section
              id="mission_sociale"
              titre={LETTRE_MISSION_CONTENT.missionSociale?.titre ?? "Mission sociale"}
              defaultOpen={false}
              disabled
              status="disabled"
            >
              <div />
            </Section>
          )}

          {/* Juridique */}
          <MissionToggle
            icon={<Scale className="h-4 w-4" />}
            label="Mission juridique"
            active={missions.juridique}
            onToggle={() => toggleMission("juridique")}
          />
          {missions.juridique ? (
            <div className="ml-8 animate-slideDown">
              <Section
                id="mission_juridique"
                titre={LETTRE_MISSION_CONTENT.missionJuridique?.titre ?? "Mission juridique"}
                defaultOpen
                status={getSectionStatus(sections.missionJuridique)}
              >
                <textarea
                  value={sections.missionJuridique ?? ""}
                  onChange={(e) => updateSection("missionJuridique", e.target.value)}
                  rows={4}
                  className={TEXTAREA_CLS}
                  style={TEXTAREA_STYLE}
                />
              </Section>
            </div>
          ) : (
            <Section
              id="mission_juridique"
              titre={LETTRE_MISSION_CONTENT.missionJuridique?.titre ?? "Mission juridique"}
              defaultOpen={false}
              disabled
              status="disabled"
            >
              <div />
            </Section>
          )}

          {/* Contrôle fiscal */}
          <MissionToggle
            icon={<Search className="h-4 w-4" />}
            label="Contrôle fiscal"
            active={missions.controleFiscal}
            onToggle={() => toggleMission("controleFiscal")}
          />
          {missions.controleFiscal ? (
            <div className="ml-8 space-y-2 animate-slideDown">
              {CONTROLE_FISCAL_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-start gap-2 cursor-pointer text-sm"
                >
                  <input
                    type="radio"
                    name="controleFiscal"
                    checked={missions.controleFiscalOption === opt.id}
                    onChange={() =>
                      setMissions((m) => ({
                        ...m,
                        controleFiscalOption: opt.id,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 text-blue-600"
                  />
                  <div>
                    <span className="font-medium text-slate-200">
                      {opt.label}
                    </span>
                    <span className="text-slate-400 ml-1 text-xs">
                      — {opt.texte}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <Section
              id="mission_controle_fiscal"
              titre={LETTRE_MISSION_CONTENT.missionControleFiscal?.titre ?? "Contrôle fiscal"}
              defaultOpen={false}
              disabled
              status="disabled"
            >
              <div />
            </Section>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 7 — HONORAIRES (tableau)                             */}
      {/* ============================================================ */}
      <Section
        id="honoraires"
        titre={LETTRE_MISSION_CONTENT.honoraires?.titre ?? "HONORAIRES"}
        status={honoraires.honoraires > 0 ? "complete" : "warning"}
      >
        <table className="w-full text-sm border-collapse border border-slate-600 rounded overflow-hidden">
          <thead>
            <tr className="bg-slate-700">
              <th className="text-left py-2 px-3 font-medium text-slate-300 border-r border-slate-600">
                Prestation
              </th>
              <th className="text-right py-2 px-3 font-medium text-slate-300 w-44">
                Montant HT
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-600">
              <td className="py-2 px-3 text-slate-300 border-r border-slate-600">
                Forfait annuel comptable
              </td>
              <td className="py-1 px-3 text-right">
                <input
                  type="number"
                  value={honoraires.honoraires}
                  onChange={(e) =>
                    setHonoraires((h) => ({
                      ...h,
                      honoraires: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-28 text-right border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400 ml-1">€</span>
              </td>
            </tr>
            <tr className="border-t border-slate-600 bg-slate-700/30">
              <td className="py-2 px-3 text-slate-300 border-r border-slate-600">
                Constitution du dossier
              </td>
              <td className="py-1 px-3 text-right">
                <input
                  type="number"
                  value={honoraires.setup}
                  onChange={(e) =>
                    setHonoraires((h) => ({
                      ...h,
                      setup: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-28 text-right border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400 ml-1">€</span>
              </td>
            </tr>
            <tr className="border-t border-slate-600">
              <td className="py-2 px-3 text-slate-300 border-r border-slate-600">
                Honoraires juridique
              </td>
              <td className="py-1 px-3 text-right">
                <input
                  type="number"
                  value={honoraires.honorairesJuridique}
                  onChange={(e) =>
                    setHonoraires((h) => ({
                      ...h,
                      honorairesJuridique: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-28 text-right border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-400 ml-1">€</span>
              </td>
            </tr>
            <tr className="border-t border-slate-600 bg-slate-700/30">
              <td className="py-2 px-3 text-slate-300 border-r border-slate-600">
                Honoraires Expert-Comptable (hors forfait)
              </td>
              <td className="py-2 px-3 text-right text-slate-400">
                200 € / heure
              </td>
            </tr>
            <tr className="border-t border-slate-600">
              <td className="py-2 px-3 text-slate-300 border-r border-slate-600">
                Honoraires Collaborateur (hors forfait)
              </td>
              <td className="py-2 px-3 text-right text-slate-400">
                100 € / heure
              </td>
            </tr>

            {/* Social */}
            {missions.sociale && (
              <>
                <tr className="border-t-2">
                  <td
                    colSpan={2}
                    className="py-1.5 px-3 text-xs font-semibold text-blue-300 uppercase tracking-wide bg-blue-900/30"
                  >
                    Mission sociale
                  </td>
                </tr>
                {[
                  { label: "Bulletin de paie", montant: "32 € / bulletin" },
                  { label: "Fin de contrat (STC + attestations)", montant: "30 €" },
                  { label: "Contrat de travail simple (CDI / CDD)", montant: "100 €" },
                  { label: "Entrée salarié (DPAE + dossier)", montant: "30 €" },
                  { label: "Attestation maladie / AT", montant: "30 €" },
                ].map((l, i) => (
                  <tr
                    key={l.label}
                    className={`border-t border-slate-600 ${i % 2 ? "bg-slate-700/30" : ""}`}
                  >
                    <td className="py-2 px-3 text-slate-300 border-r border-slate-600">
                      {l.label}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">
                      {l.montant}
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Juridique */}
            {missions.juridique && (
              <>
                <tr className="border-t-2">
                  <td
                    colSpan={2}
                    className="py-1.5 px-3 text-xs font-semibold text-blue-300 uppercase tracking-wide bg-blue-900/30"
                  >
                    Mission juridique annuelle
                  </td>
                </tr>
                <tr className="border-t border-slate-600">
                  <td className="py-2 px-3 text-slate-300 border-r border-slate-600">
                    Forfait annuel juridique
                  </td>
                  <td className="py-1 px-3 text-right">
                    <input
                      type="number"
                      value={honoraires.honorairesJuridique}
                      onChange={(e) =>
                        setHonoraires((h) => ({
                          ...h,
                          honorairesJuridique: Number(e.target.value) || 0,
                        }))
                      }
                      className="w-28 text-right border border-slate-600 rounded px-2 py-1 text-sm bg-slate-900 text-slate-200 focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-slate-400 ml-1">€</span>
                  </td>
                </tr>
              </>
            )}

            {/* Contrôle fiscal */}
            {missions.controleFiscal &&
              missions.controleFiscalOption !== "RENONCE" && (
                <>
                  <tr className="border-t-2">
                    <td
                      colSpan={2}
                      className="py-1.5 px-3 text-xs font-semibold text-blue-300 uppercase tracking-wide bg-blue-900/30"
                    >
                      Assistance contrôle fiscal
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-3 text-slate-300 border-r border-slate-600">
                      {CONTROLE_FISCAL_OPTIONS.find(
                        (o) => o.id === missions.controleFiscalOption,
                      )?.label ?? ""}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">
                      {CONTROLE_FISCAL_OPTIONS.find(
                        (o) => o.id === missions.controleFiscalOption,
                      )?.montant?.toLocaleString("fr-FR") ?? "—"}{" "}
                      €
                    </td>
                  </tr>
                </>
              )}
          </tbody>
        </table>

        {/* Calcul auto — selon fréquence */}
        <div className="mt-3 bg-blue-900/30 rounded-lg px-4 py-3 text-center">
          <span className="text-slate-400">Soit </span>
          <span className="font-bold text-blue-300 text-lg">
            {montantPeriodique} € HT
          </span>
          <span className="text-slate-400"> / {periodeLabel}</span>
        </div>

        <div className="mt-2 text-xs text-slate-500 leading-relaxed">
          Nos honoraires seront facturés{" "}
          {(client.frequence || "mensuel").toLowerCase()}lement, réglés par
          prélèvement automatique à 30 jours et révisables annuellement avec un
          minimum forfaitaire de 3 %.
        </div>
      </Section>

      {/* ============================================================ */}
      {/* SECTION 9 — SIGNATURE                                        */}
      {/* ============================================================ */}
      <Section
        id="signature"
        titre={LETTRE_MISSION_CONTENT.signature?.titre ?? "Signatures"}
        status="complete"
      >
        <div className="text-center text-sm text-slate-400 mb-6">
          Fait à Marseille, le{" "}
          {new Date().toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="text-center space-y-3">
            <p className="text-sm font-semibold text-slate-200">
              L'Expert-comptable
            </p>
            <p className="text-sm text-slate-400">{client.associe || "—"}</p>
            <div className="border-b border-slate-600 mx-8 mt-8" />
            <p className="text-xs text-slate-500">Signature</p>
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm font-semibold text-slate-200">Le Client</p>
            <p className="text-sm text-slate-400">{client.dirigeant || "—"}</p>
            <div className="border-b border-slate-600 mx-8 mt-8" />
            <p className="text-xs text-slate-500">Signature</p>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/* SECTION 10 — ANNEXES (onglets horizontaux)                   */}
      {/* ============================================================ */}
      <div className="border border-slate-700 rounded-lg bg-slate-800 shadow-sm" data-section="10">
        <div className="border-b border-slate-700">
          <div className="flex overflow-x-auto">
            {ANNEXE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAnnexeTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  annexeTab === tab.id
                    ? "border-blue-500 text-blue-300 bg-blue-900/30"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {annexeTab === "repartition" && <RepartitionTravaux />}
          {annexeTab === "dissimule" && (
            <AttestationTravailDissimule client={client} />
          )}
          {annexeTab === "sepa" && <MandatSepa client={client} />}
          {annexeTab === "liasse" && (
            <AutorisationLiasse client={client} associe={client.associe || ""} />
          )}
          {annexeTab === "cgv" && <ConditionsGenerales />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle switch sub-component
// ---------------------------------------------------------------------------

function MissionToggle({
  icon,
  label,
  active,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 px-4 rounded-lg border border-slate-600 hover:bg-slate-700/50 transition-colors">
      <div className="flex items-center gap-2.5">
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm font-medium text-slate-200">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          active ? "bg-blue-600" : "bg-slate-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-[24px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}
