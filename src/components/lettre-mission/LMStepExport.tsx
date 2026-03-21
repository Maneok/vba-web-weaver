import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { LMWizardData } from "@/lib/lmWizardTypes";
import { LM_STATUTS, computeAnnexes, ANNEXE_LABELS } from "@/lib/lmWizardTypes";
import { buildClientFromWizardData } from "@/lib/lmUtils";
import { useAuth } from "@/lib/auth/AuthContext";
import { sanitizeWizardData } from "@/lib/lmValidation";
import { DEFAULT_TEMPLATE } from "@/lib/lettreMissionTemplate";
import { buildVariablesMap, resolveModeleSections } from "@/lib/lettreMissionEngine";
import { formatDateFr } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileDown, FileText, Send, CheckCircle2,
  Loader2, Paperclip, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  data: LMWizardData;
  onChange: (updates: Partial<LMWizardData>) => void;
  onSave: () => Promise<void>;
  onReset: () => void;
  saving?: boolean;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export default function LMStepExport({ data, onChange, onSave, onReset, saving }: Props) {
  const { profile } = useAuth();
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState(data.email || "");
  const [showSignature, setShowSignature] = useState(false);
  const lockRef = useRef(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // Cabinet info
  const [cabinetInfo, setCabinetInfo] = useState<Record<string, string>>({
    nom: profile?.full_name ? `Cabinet ${profile.full_name}` : "Cabinet Expertise Comptable",
    adresse: "", cp: "", ville: "", siret: "", numeroOEC: "", email: profile?.email || "", telephone: "",
  });
  useEffect(() => {
    if (!profile?.cabinet_id) return;
    supabase
      .from("parametres")
      .select("valeur")
      .eq("cabinet_id", profile.cabinet_id)
      .eq("cle", "cabinet_info")
      .maybeSingle()
      .then(({ data: row }) => {
        if (row?.valeur) {
          try {
            const info = typeof row.valeur === "string" ? JSON.parse(row.valeur) : row.valeur;
            setCabinetInfo((prev) => ({
              ...prev,
              nom: info.nom || prev.nom,
              adresse: info.adresse || "",
              cp: info.code_postal || "",
              ville: info.ville || "",
              siret: info.siret || "",
              numeroOEC: info.numero_oec || "",
              email: info.email || prev.email,
              telephone: info.telephone || "",
              logo: info.logo || "",
              croec: info.croec || "",
              tvaIntracommunautaire: info.tva_intracommunautaire || "",
              assureurNom: info.assureur_nom || "",
              assureurAdresse: info.assureur_adresse || "",
            }));
          } catch { /* ignore */ }
        }
      });
  }, [profile?.cabinet_id]);

  // Compute annexes
  const prevAnnexesRef = useRef<string>("");
  useEffect(() => {
    const computed = computeAnnexes(data);
    const key = computed.join(",");
    if (key !== prevAnnexesRef.current) {
      prevAnnexesRef.current = key;
      onChange({ annexes: computed });
    }
  }, [data.missions_selected, data.type_mission, data.mission_type_id, data.clause_travail_dissimule]);

  const annexes = data.annexes || [];

  const withLock = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setGenerating(key);
    try {
      await fn();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la generation");
    } finally {
      setGenerating(null);
      lockRef.current = false;
    }
  }, []);

  const handlePDF = () => withLock("pdf", async () => {
    const sanitized = sanitizeWizardData(data);

    if (data.modele_id) {
      try {
        const { getModeleById } = await import("@/lib/lettreMissionModeles");
        const { generatePdfFromInstance } = await import("@/lib/lettreMissionPdf");
        const modele = await getModeleById(data.modele_id);
        const varsMap = buildVariablesMap(sanitized as unknown as Record<string, unknown>);
        const missionsSelected = sanitized.missions_selected?.map((m) => ({ section_id: m.section_id, selected: m.selected })) ?? [];
        const resolved = resolveModeleSections(modele.sections, varsMap, missionsSelected);
        const clientForPdf = buildClientFromWizardData(sanitized);
        const honDetail: Record<string, number> = {};
        if (data.honoraires_detail) {
          for (const [k, v] of Object.entries(data.honoraires_detail)) {
            const n = parseFloat(String(v));
            if (Number.isFinite(n) && n > 0) honDetail[k] = n;
          }
        }
        await generatePdfFromInstance({
          sections_snapshot: resolved,
          cgv_snapshot: modele.cgv_content,
          repartition_snapshot: modele.repartition_taches,
          numero: data.numero_lettre || `LM-${new Date().getFullYear()}-001`,
          status: data.statut,
          mission_type: data.mission_type_id || modele.mission_type || "presentation",
        }, cabinetInfo, {
          signatureExpert: data.signature_expert,
          signatureClient: data.signature_client,
          client: clientForPdf,
          honoraires: {
            honorairesComptable: data.honoraires_ht,
            periodicite: data.frequence_facturation,
          },
          iban: data.iban || "",
          bic: data.bic || "",
          mode_paiement: data.mode_paiement || "prelevement",
          honoraires_detail: Object.keys(honDetail).length > 0 ? honDetail : undefined,
        });
        toast.success("PDF genere depuis le modele");
        return;
      } catch (err) {
        console.warn("Modele PDF failed, falling back to legacy:", err);
      }
    }

    const { renderLettreMissionPdf } = await import("@/lib/lettreMissionPdf");
    const client = buildClientFromWizardData(sanitized);
    const lm = {
      numero: data.numero_lettre || `LM-${new Date().getFullYear()}-001`,
      date: formatDateFr(new Date(), "short"),
      client,
      cabinet: cabinetInfo,
      options: {
        genre: (data.genre || "M") as const,
        missionSociale: data.missions_selected.some((m) => m.section_id === "social" && m.selected),
        missionJuridique: data.missions_selected.some((m) => m.section_id === "juridique" && m.selected),
        missionControleFiscal: data.missions_selected.some((m) => m.section_id === "fiscal" && m.selected),
        regimeFiscal: "", exerciceDebut: "", exerciceFin: "",
        tvaRegime: "", volumeComptable: "", cac: false, outilComptable: "",
        periodicite: data.frequence_facturation,
        missionTypeId: data.mission_type_id || "presentation",
      },
    };
    await renderLettreMissionPdf(lm);
    toast.success("PDF genere avec succes");
  });

  const handleDOCX = () => withLock("docx", async () => {
    const sanitized = sanitizeWizardData(data);

    if (data.modele_id) {
      try {
        const { getModeleById } = await import("@/lib/lettreMissionModeles");
        const { generateDocxFromInstance } = await import("@/lib/lettreMissionDocx");
        const modele = await getModeleById(data.modele_id);
        const varsMap = buildVariablesMap(sanitized as unknown as Record<string, unknown>);
        const missionsSelected = sanitized.missions_selected?.map((m) => ({ section_id: m.section_id, selected: m.selected })) ?? [];
        const resolved = resolveModeleSections(modele.sections, varsMap, missionsSelected);
        const clientForDocx = buildClientFromWizardData(sanitized);
        await generateDocxFromInstance({
          sections_snapshot: resolved,
          cgv_snapshot: modele.cgv_content,
          repartition_snapshot: modele.repartition_taches,
          numero: data.numero_lettre || `LM-${new Date().getFullYear()}-001`,
          status: data.statut,
          mission_type: data.mission_type_id || modele.mission_type || "presentation",
        }, cabinetInfo, {
          raison_sociale: clientForDocx.raisonSociale,
          forme_juridique: clientForDocx.forme,
          nom_dirigeant: clientForDocx.dirigeant,
          adresse: clientForDocx.adresse,
          code_postal: clientForDocx.cp,
          ville: clientForDocx.ville,
          siren: clientForDocx.siren,
          code_ape: clientForDocx.ape,
          capital_social: clientForDocx.capital ? String(clientForDocx.capital) : "",
        }, {
          forfait_annuel_ht: data.honoraires_ht,
          frequence_facturation: data.frequence_facturation || "MENSUEL",
          iban: data.iban || "",
          bic: data.bic || "",
          mode_paiement: data.mode_paiement || "prelevement",
          honoraires_detail: (() => {
            const d: Record<string, number> = {};
            if (data.honoraires_detail) {
              for (const [k, v] of Object.entries(data.honoraires_detail)) {
                const n = parseFloat(String(v));
                if (Number.isFinite(n) && n > 0) d[k] = n;
              }
            }
            return Object.keys(d).length > 0 ? d : undefined;
          })(),
        });
        toast.success("DOCX genere depuis le modele");
        return;
      } catch (err) {
        console.warn("Modele DOCX failed, falling back to legacy:", err);
      }
    }

    const { renderNewLettreMissionDocx } = await import("@/lib/lettreMissionDocx");
    const client = buildClientFromWizardData(sanitized);
    await renderNewLettreMissionDocx({
      sections: DEFAULT_TEMPLATE,
      client,
      genre: "M",
      missions: {
        sociale: data.missions_selected.some((m) => m.section_id === "social" && m.selected),
        juridique: data.missions_selected.some((m) => m.section_id === "juridique" && m.selected),
        fiscal: data.missions_selected.some((m) => m.section_id === "fiscal" && m.selected),
      },
      honoraires: {
        comptable: data.honoraires_ht,
        constitution: 0,
        juridique: 0,
        frequence: (data.frequence_facturation || "MENSUEL") as "MENSUEL" | "TRIMESTRIEL" | "ANNUEL",
      },
      cabinet: cabinetInfo,
      variables: {},
      status: data.statut,
      signatureExpert: data.signature_expert,
      signatureClient: data.signature_client,
      missionTypeId: data.mission_type_id || "presentation",
    });
    toast.success("DOCX genere avec succes");
  });

  const handleEmail = () => {
    if (!emailTo) {
      toast.error("Adresse email requise");
      return;
    }
    window.location.href = `mailto:${emailTo}?subject=Lettre de mission - ${data.raison_sociale}&body=Veuillez trouver ci-joint la lettre de mission.`;
    toast.success("Client email ouvert");
  };

  const handleSave = async () => {
    try {
      await onSave();
    } catch {
      // onSave already shows error toasts
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Summary card ── */}
      <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-slate-900 dark:text-white">Lettre de mission prete</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {data.raison_sociale}
            {data.type_mission && <> · {data.type_mission}</>}
            {data.honoraires_ht > 0 && <> · {formatEur(data.honoraires_ht)} HT</>}
          </p>
        </div>
      </div>

      {/* ── Export actions ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={handlePDF}
          disabled={!!generating}
          className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] hover:border-blue-200 dark:hover:border-blue-500/20 hover:bg-blue-50/30 dark:hover:bg-blue-500/[0.04] disabled:opacity-40 transition-all duration-200 hover:shadow-md hover:shadow-blue-100/50 dark:hover:shadow-blue-500/5"
        >
          {generating === "pdf"
            ? <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            : <FileDown className="w-6 h-6 text-blue-400" />}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telecharger PDF</span>
        </button>

        <button
          onClick={handleDOCX}
          disabled={!!generating}
          className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] hover:border-purple-200 dark:hover:border-purple-500/20 hover:bg-purple-50/30 dark:hover:bg-purple-500/[0.04] disabled:opacity-40 transition-all duration-200 hover:shadow-md hover:shadow-purple-100/50 dark:hover:shadow-purple-500/5"
        >
          {generating === "docx"
            ? <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            : <FileText className="w-6 h-6 text-purple-400" />}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Telecharger DOCX</span>
        </button>

        <button
          onClick={() => setShowEmail(!showEmail)}
          disabled={!!generating}
          className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] hover:border-emerald-200 dark:hover:border-emerald-500/20 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/[0.04] disabled:opacity-40 transition-all duration-200 hover:shadow-md hover:shadow-emerald-100/50 dark:hover:shadow-emerald-500/5"
        >
          <Send className="w-6 h-6 text-emerald-400" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Envoyer par email</span>
        </button>
      </div>

      {/* Email field */}
      <div className={`overflow-hidden transition-all duration-200 ${showEmail ? "max-h-[100px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-slate-400 dark:text-slate-500 text-xs">Adresse email</Label>
            <Input
              type="email"
              inputMode="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="h-12 rounded-xl bg-gray-50/80 dark:bg-white/[0.04] border-gray-100 dark:border-white/[0.06]"
              placeholder="client@exemple.fr"
            />
          </div>
          <Button onClick={handleEmail} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-12 gap-1.5">
            <Send className="w-3.5 h-3.5" /> Envoyer
          </Button>
        </div>
      </div>

      {/* ── Annexes ── */}
      {annexes.length > 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <Paperclip className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Annexes jointes ({annexes.length})</p>
          </div>
          <div className="space-y-1.5">
            {annexes.map((id) => (
              <div key={id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-50/60 dark:bg-white/[0.02]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-500 dark:text-slate-400">{ANNEXE_LABELS[id] || id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Signature (accordion) ── */}
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-100 dark:border-white/[0.06] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSignature(!showSignature)}
          className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Signature</p>
            {data.statut && (
              <Badge className={`text-[9px] ${
                LM_STATUTS.find((s) => s.value === data.statut)?.color || "bg-slate-500/10 text-slate-400 border-slate-500/20"
              }`}>
                {LM_STATUTS.find((s) => s.value === data.statut)?.label || data.statut}
              </Badge>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${showSignature ? "rotate-180" : ""}`} />
        </button>
        <div className={`overflow-hidden transition-all duration-200 ${showSignature ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-white/[0.04]">
            {/* Statut workflow */}
            <div className="flex flex-wrap gap-2 pt-4">
              {LM_STATUTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => onChange({ statut: s.value })}
                  className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                    data.statut === s.value ? s.color : "bg-white dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] text-slate-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-white/[0.1]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-slate-400 dark:text-slate-500 text-xs">Date de signature</Label>
              <Input
                type="date"
                lang="fr"
                value={data.date_signature}
                onChange={(e) => onChange({ date_signature: e.target.value })}
                className="h-12 rounded-xl bg-gray-50/80 dark:bg-white/[0.04] border-gray-100 dark:border-white/[0.06] w-48"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Save + Reset ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 gap-2 disabled:opacity-50 transition-all duration-200"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Sauvegarder
        </Button>
        <Button
          variant="outline"
          onClick={onReset}
          className="rounded-xl h-12 border-gray-200 dark:border-white/[0.06] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all duration-200"
        >
          Nouvelle lettre
        </Button>
      </div>
    </div>
  );
}
