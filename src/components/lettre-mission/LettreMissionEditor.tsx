import { useState, useMemo, useEffect, Fragment } from "react";
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
    id: sec.id,
    title: sec.titre,
    visible: sec.obligatoire || false,
    content: sec.contenu,
    editable: true,
  }));
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

function buildVariables(
  client: Client,
  genre: Genre,
  honoraires: HonorairesEditable,
): Record<string, string> {
  const fp = getFormulePolitesse(genre);
  return {
    formule_politesse: fp,
    formule_politesse_fin: fp,
    dirigeant: client.dirigeant || "",
    raison_sociale: client.raisonSociale || "",
    forme_juridique: client.forme || "",
    domaine: client.domaine || "",
    ape: client.ape || "",
    siren: client.siren || "",
    capital: client.capital ? `${client.capital.toLocaleString("fr-FR")} €` : "",
    date_creation: client.dateCreation || "",
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
    niv_vigilance: client.nivVigilance || "STANDARD",
    ppe: client.ppe || "NON",
    date_revue: client.dateDerniereRevue || "—",
    date_butoir: client.dateButoir || "—",
    bloc_vigilance_lab: LCBFT_TEMPLATES[client.nivVigilance || "STANDARD"]?.corps || "",
  };
}

function renderWithVariables(
  text: string,
  vars: Record<string, string>,
): React.ReactNode[] {
  const parts = text.split(/(\{\{[a-z_]+\}\})/g);
  return parts.map((part, i) => {
    const match = part.match(/^\{\{([a-z_]+)\}\}$/);
    if (match) {
      const val = vars[match[1]];
      if (val) {
        return (
          <span key={i} className="bg-blue-100 text-blue-800 px-0.5 rounded">
            {val}
          </span>
        );
      }
      return (
        <span key={i} className="bg-orange-100 text-orange-600 px-0.5 rounded">
          {part}
        </span>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
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

function getVigilanceBadge(level: VigilanceLevel) {
  const cfg = {
    SIMPLIFIEE: { bg: "bg-green-100 text-green-800", label: "Simplifiée" },
    STANDARD: { bg: "bg-amber-100 text-amber-800", label: "Standard" },
    RENFORCEE: { bg: "bg-red-100 text-red-800", label: "Renforcée" },
  }[level] ?? { bg: "bg-gray-100 text-gray-800", label: level };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  id,
  titre,
  children,
  defaultOpen = true,
  icon,
  accentBorder,
  disabled,
}: {
  id: string;
  titre: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  accentBorder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      id={`section-${id}`}
      className={`border rounded-lg shadow-sm ${accentBorder ?? ""} ${
        disabled ? "bg-gray-100 opacity-60" : "bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
          disabled ? "cursor-not-allowed" : "hover:bg-gray-50"
        }`}
      >
        {open && !disabled ? (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
        {icon}
        <span className="text-sm font-semibold text-gray-800">{titre}</span>
        {disabled && (
          <span className="ml-auto text-xs text-gray-400">Désactivée</span>
        )}
      </button>
      {open && !disabled && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function InlinePreview({
  text,
  vars,
}: {
  text: string;
  vars: Record<string, string>;
}) {
  return (
    <div className="mt-1.5 px-3 py-2 bg-gray-50 rounded border border-dashed border-gray-200 text-xs text-gray-500 italic leading-relaxed whitespace-pre-line">
      <span className="text-gray-400 not-italic font-medium">Aperçu : </span>
      {renderWithVariables(text, vars)}
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
    <tr className={even ? "bg-gray-50" : ""}>
      <td className="py-2 px-3 text-sm font-medium text-gray-600 w-1/3 border-r">
        {label}
      </td>
      <td className="py-1 px-2">
        <div className="relative">
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-2 py-1.5 text-sm rounded border ${
              empty
                ? "border-orange-400 focus:ring-orange-400"
                : "border-gray-200 focus:ring-blue-500"
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
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Sélectionnez un client pour commencer la lettre de mission.
      </div>
    );
  }

  // --- State ---
  const [sections, setSections] = useState(() => {
    const s: Record<string, string> = {};
    for (const [key, sec] of Object.entries(LETTRE_MISSION_CONTENT)) {
      if (sec && sec.contenu) {
        s[key] = sec.contenu;
      }
    }
    return s;
  });

  const [entity, setEntity] = useState(() => ({
    raison_sociale: client.raisonSociale || "",
    forme_juridique: client.forme || "",
    domaine: client.domaine || "",
    ape: client.ape || "",
    siren: client.siren || "",
    capital: client.capital ? String(client.capital) : "",
    date_creation: client.dateCreation || "",
    associe: client.associe || "",
    effectif: client.effectif || "",
    mission: (client.mission as string) || "",
    frequence: client.frequence || "",
  }));

  const [missions, setMissions] = useState<MissionsConfig>({
    sociale: false,
    juridique: false,
    controleFiscal: false,
    controleFiscalOption: "A",
  });

  const [honoraires, setHonoraires] = useState<HonorairesEditable>({
    honoraires: client.honoraires || 0,
    setup: client.reprise || 0,
    honorairesJuridique: client.juridique || 0,
  });

  const [missionEditable, setMissionEditable] = useState(false);

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
  const vars = useMemo(
    () => buildVariables(client, genre, honoraires),
    [client, genre, honoraires],
  );

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
  }

  const entityFields = [
    { key: "raison_sociale" as const, label: "Raison sociale" },
    { key: "forme_juridique" as const, label: "Forme juridique" },
    { key: "domaine" as const, label: "Activité(s) principale(s)" },
    { key: "ape" as const, label: "Code APE" },
    { key: "siren" as const, label: "SIREN" },
    { key: "capital" as const, label: "Capital social" },
    { key: "date_creation" as const, label: "Date de création" },
    { key: "associe" as const, label: "EC responsable" },
    { key: "effectif" as const, label: "Effectif du personnel" },
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
  const vigilanceTemplate = LCBFT_TEMPLATES[nivVigilance];

  // --- Render ---
  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* SECTION 1 — INTRODUCTION                                     */}
      {/* ============================================================ */}
      <Section
        id="introduction"
        titre={LETTRE_MISSION_CONTENT.introduction?.titre ?? "Introduction"}
      >
        <textarea
          value={sections.introduction ?? ""}
          onChange={(e) => updateSection("introduction", e.target.value)}
          rows={6}
          className="w-full border rounded px-3 py-2 text-sm leading-relaxed focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y"
        />
        <InlinePreview text={sections.introduction ?? ""} vars={vars} />
      </Section>

      {/* ============================================================ */}
      {/* SECTION 2 — VOTRE ENTITÉ (tableau éditable)                  */}
      {/* ============================================================ */}
      <Section
        id="entite"
        titre={LETTRE_MISSION_CONTENT.entite?.titre ?? "VOTRE ENTITÉ"}
      >
        <table className="w-full border-collapse border rounded overflow-hidden">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-r w-1/3">
                Champ
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
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
      {/* SECTION 3 — LCB-FT                                          */}
      {/* ============================================================ */}
      <Section
        id="lcbft"
        titre={LETTRE_MISSION_CONTENT.lcbft?.titre ?? "OBLIGATIONS DE VIGILANCE – LCB-FT"}
        icon={<Lock className="h-4 w-4 text-[#1a1a2e]" />}
        accentBorder="border-l-4 border-l-[#1a1a2e]"
      >
        {LETTRE_MISSION_CONTENT.lcbft?.soustitre && (
          <p className="text-xs text-gray-400 mb-3 -mt-1">
            {LETTRE_MISSION_CONTENT.lcbft.soustitre}
          </p>
        )}

        {/* Score + Vigilance + PPE + KYC */}
        <div className="bg-[#f4f4f8] rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`text-[32px] font-bold leading-none ${getScoreColor(scoreGlobal)}`}
              >
                {scoreGlobal}
              </span>
              <div>
                <div className="text-xs text-gray-400">/ 100</div>
                {getVigilanceBadge(nivVigilance)}
              </div>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Statut PPE</span>
                <span
                  className={
                    client.ppe === "OUI"
                      ? "font-semibold text-red-600"
                      : "text-gray-700"
                  }
                >
                  {client.ppe || "NON"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Dernière KYC</span>
                <span className="text-gray-700">
                  {client.dateDerniereRevue || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Prochaine KYC</span>
                <span className="text-gray-700">
                  {client.dateButoir || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bloc vigilance dynamique — adapté au niveau */}
        {vigilanceTemplate && (
          <div
            className={`rounded p-3 mb-3 text-sm leading-relaxed ${getScoreBg(scoreGlobal)}`}
          >
            <p className="font-semibold text-gray-800 mb-1">
              {vigilanceTemplate.titre}
            </p>
            <p className="text-gray-700 whitespace-pre-line text-xs">
              {vigilanceTemplate.corps}
            </p>
          </div>
        )}

        {/* Engagements + Conservation */}
        <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
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
      >
        <div className="relative">
          <textarea
            value={sections.mission ?? ""}
            onChange={(e) => updateSection("mission", e.target.value)}
            readOnly={!missionEditable}
            rows={10}
            className={`w-full border rounded px-3 py-2 text-sm leading-relaxed focus:outline-none resize-y ${
              missionEditable
                ? "focus:ring-1 focus:ring-blue-500 bg-white"
                : "bg-gray-50 text-gray-600 cursor-default"
            }`}
          />
          {!missionEditable && (
            <button
              type="button"
              onClick={() => setMissionEditable(true)}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 text-xs bg-white border rounded shadow-sm text-blue-600 hover:bg-blue-50 transition-colors"
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
      >
        <textarea
          value={sections.duree ?? ""}
          onChange={(e) => updateSection("duree", e.target.value)}
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm leading-relaxed focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y"
        />
        <InlinePreview text={sections.duree ?? ""} vars={vars} />
      </Section>

      {/* ============================================================ */}
      {/* SECTIONS 5-6-7 — MISSIONS COMPLÉMENTAIRES (toggles)          */}
      {/* ============================================================ */}
      <div className="border rounded-lg bg-white shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Missions complémentaires
        </h3>
        <div className="space-y-3">
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
              >
                <textarea
                  value={sections.missionSociale ?? ""}
                  onChange={(e) => updateSection("missionSociale", e.target.value)}
                  rows={8}
                  className="w-full border rounded px-3 py-2 text-sm leading-relaxed focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y"
                />
              </Section>
            </div>
          ) : (
            <Section
              id="mission_sociale"
              titre={LETTRE_MISSION_CONTENT.missionSociale?.titre ?? "Mission sociale"}
              defaultOpen={false}
              disabled
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
              >
                <textarea
                  value={sections.missionJuridique ?? ""}
                  onChange={(e) => updateSection("missionJuridique", e.target.value)}
                  rows={4}
                  className="w-full border rounded px-3 py-2 text-sm leading-relaxed focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y"
                />
              </Section>
            </div>
          ) : (
            <Section
              id="mission_juridique"
              titre={LETTRE_MISSION_CONTENT.missionJuridique?.titre ?? "Mission juridique"}
              defaultOpen={false}
              disabled
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
                    <span className="font-medium text-gray-700">
                      {opt.label}
                    </span>
                    <span className="text-gray-500 ml-1 text-xs">
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
            >
              <div />
            </Section>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 8 — HONORAIRES (tableau)                             */}
      {/* ============================================================ */}
      <Section
        id="honoraires"
        titre={LETTRE_MISSION_CONTENT.honoraires?.titre ?? "HONORAIRES"}
      >
        <table className="w-full text-sm border-collapse border rounded overflow-hidden">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left py-2 px-3 font-medium text-gray-600 border-r">
                Prestation
              </th>
              <th className="text-right py-2 px-3 font-medium text-gray-600 w-44">
                Montant HT
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-2 px-3 text-gray-700 border-r">
                Forfait annuel de tenue / surveillance
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
                  className="w-28 text-right border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 ml-1">€</span>
              </td>
            </tr>
            <tr className="border-t bg-gray-50">
              <td className="py-2 px-3 text-gray-700 border-r">
                Constitution du dossier permanent
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
                  className="w-28 text-right border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 ml-1">€</span>
              </td>
            </tr>
            <tr className="border-t">
              <td className="py-2 px-3 text-gray-700 border-r">
                Honoraires Expert-Comptable (hors forfait)
              </td>
              <td className="py-2 px-3 text-right text-gray-600">
                200 € / heure
              </td>
            </tr>
            <tr className="border-t bg-gray-50">
              <td className="py-2 px-3 text-gray-700 border-r">
                Honoraires Collaborateur (hors forfait)
              </td>
              <td className="py-2 px-3 text-right text-gray-600">
                100 € / heure
              </td>
            </tr>

            {/* Social */}
            {missions.sociale && (
              <>
                <tr className="border-t-2">
                  <td
                    colSpan={2}
                    className="py-1.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-blue-50"
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
                    className={`border-t ${i % 2 ? "bg-gray-50" : ""}`}
                  >
                    <td className="py-2 px-3 text-gray-700 border-r">
                      {l.label}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
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
                    className="py-1.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-blue-50"
                  >
                    Mission juridique annuelle
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="py-2 px-3 text-gray-700 border-r">
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
                      className="w-28 text-right border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400 ml-1">€</span>
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
                      className="py-1.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-blue-50"
                    >
                      Assistance contrôle fiscal
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="py-2 px-3 text-gray-700 border-r">
                      {CONTROLE_FISCAL_OPTIONS.find(
                        (o) => o.id === missions.controleFiscalOption,
                      )?.label ?? ""}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
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
        <div className="mt-3 bg-blue-50 rounded px-4 py-2 text-sm text-center">
          <span className="text-gray-600">Soit </span>
          <span className="font-bold text-blue-800">
            {montantPeriodique} € HT
          </span>
          <span className="text-gray-600"> / {periodeLabel}</span>
        </div>

        <div className="mt-2 text-xs text-gray-400">
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
      >
        <div className="text-center text-sm text-gray-600 mb-6">
          Fait à Marseille, le{" "}
          {new Date().toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="text-center space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              L'Expert-comptable
            </p>
            <p className="text-sm text-gray-600">{client.associe || "—"}</p>
            <div className="border-b border-gray-300 mx-8 mt-8" />
            <p className="text-xs text-gray-400">Signature</p>
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm font-semibold text-gray-700">Le Client</p>
            <p className="text-sm text-gray-600">{client.dirigeant || "—"}</p>
            <div className="border-b border-gray-300 mx-8 mt-8" />
            <p className="text-xs text-gray-400">Signature</p>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/* SECTION 10 — ANNEXES (onglets horizontaux)                   */}
      {/* ============================================================ */}
      <div className="border rounded-lg bg-white shadow-sm">
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {ANNEXE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAnnexeTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  annexeTab === tab.id
                    ? "border-blue-600 text-blue-700 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
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
    <div className="flex items-center justify-between py-2 px-3 rounded border hover:bg-gray-50">
      <div className="flex items-center gap-2">
        <span className="text-gray-500">{icon}</span>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          active ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            active ? "translate-x-[18px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}
