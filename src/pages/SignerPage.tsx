// ──────────────────────────────────────────────
// Page publique de signature electronique
// OPT 16-30: 7 states, progress bar, CGV accordion, print, mobile, footer
// ──────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { verifyToken, signDocument, type SignatureCertificate } from "@/lib/lettreMissionSignature";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  FileText, CheckCircle2, AlertTriangle, Clock, Loader2,
  Shield, Download, Lock, Printer, ChevronDown, ChevronUp, XCircle,
} from "lucide-react";

// OPT-16: 7 states (added expired + signing)
type PageState = "loading" | "error" | "expired" | "already_signed" | "view" | "signing" | "signed";

interface InstanceData {
  id: string;
  numero: string;
  raison_sociale: string;
  type_mission: string;
  statut: string;
  created_at: string;
  wizard_data: Record<string, unknown>;
}

export default function SignerPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [state, setState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [instance, setInstance] = useState<InstanceData | null>(null);
  const [clientNom, setClientNom] = useState("");
  const [signedAt, setSignedAt] = useState("");
  const [signer, setSigner] = useState("");

  // Signature form
  const [accepted, setAccepted] = useState(false);
  const [cgvAccepted, setCgvAccepted] = useState(false);
  const [signerNom, setSignerNom] = useState("");
  const [signerQualite, setSignerQualite] = useState("");
  const [certificate, setCertificate] = useState<SignatureCertificate | null>(null);
  const [certificateUrl, setCertificateUrl] = useState("");

  // OPT-22: CGV accordion
  const [cgvOpen, setCgvOpen] = useState(false);

  // OPT-19: Scroll progress bar
  const [scrollProgress, setScrollProgress] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!mainRef.current) return;
    const el = mainRef.current;
    const scrollTop = window.scrollY - el.offsetTop;
    const scrollHeight = el.scrollHeight - window.innerHeight;
    if (scrollHeight > 0) {
      setScrollProgress(Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100)));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Load token data
  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMsg("Aucun token de signature fourni.");
      return;
    }

    (async () => {
      const result = await verifyToken(token);

      if (result.already_signed) {
        setState("already_signed");
        setSignedAt(result.signed_at || "");
        setSigner(result.signer || "");
        return;
      }

      if (!result.valid) {
        // OPT-16: Separate expired state
        if (result.expired) {
          setState("expired");
          setErrorMsg("Ce lien de signature a expire. Veuillez contacter votre expert-comptable pour obtenir un nouveau lien.");
        } else {
          setState("error");
          setErrorMsg(result.error || "Lien de signature invalide.");
        }
        return;
      }

      setInstance(result.instance || null);
      setClientNom(result.client_nom || "");
      setSignerNom(result.client_nom || "");
      setState("view");
    })();
  }, [token]);

  const handleSign = async () => {
    if (!accepted || !cgvAccepted || !signerNom.trim()) return;

    // OPT-17: signing spinner state
    setState("signing");
    const result = await signDocument(token, signerNom.trim(), signerQualite.trim());

    if (result.success) {
      setState("signed");
      setSignedAt(result.signed_at || new Date().toISOString());
      setCertificate(result.certificate || null);
      setCertificateUrl(result.certificate_url || "");
    } else {
      setErrorMsg(result.error || "Erreur lors de la signature");
      setState("error");
    }
  };

  // OPT-23: Print button
  const handlePrint = () => window.print();

  // OPT-26: Date/time display helper
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // ── Render sections from wizard_data ──
  const renderDocumentContent = () => {
    if (!instance?.wizard_data) return null;
    const wd = instance.wizard_data;

    const sections: { title: string; content: string }[] = [];

    sections.push({
      title: "Identification des parties",
      content: `Client : ${wd.raison_sociale || ""}
Forme juridique : ${wd.forme_juridique || ""}
SIREN : ${wd.siren || ""}
Dirigeant : ${wd.dirigeant || ""} (${wd.qualite_dirigeant || ""})
Adresse : ${wd.adresse || ""}, ${wd.cp || ""} ${wd.ville || ""}`,
    });

    sections.push({
      title: "Type de mission",
      content: `Mission : ${wd.type_mission || ""}
Duree : ${wd.duree || "1"} an(s)
Date de debut : ${wd.date_debut || ""}
Reconduction tacite : ${wd.tacite_reconduction ? "Oui" : "Non"}${wd.tacite_reconduction ? `\nPreavis de resiliation : ${wd.preavis_mois || 3} mois` : ""}`,
    });

    const missions = (wd.missions_selected as Array<{ label?: string; selected?: boolean }>) || [];
    const selectedMissions = missions.filter((m) => m.selected);
    if (selectedMissions.length > 0) {
      sections.push({
        title: "Missions selectionnees",
        content: selectedMissions.map((m) => `- ${m.label || "Mission"}`).join("\n"),
      });
    }

    sections.push({
      title: "Intervenants",
      content: `Associe signataire : ${wd.associe_signataire || "\u2014"}
Chef de mission : ${wd.chef_mission || "\u2014"}
Referent LCB-FT : ${wd.referent_lcb || "\u2014"}`,
    });

    const honoraires = Number(wd.honoraires_ht) || 0;
    const tva = Number(wd.taux_tva) || 20;
    sections.push({
      title: "Honoraires",
      content: `Montant HT : ${honoraires.toLocaleString("fr-FR")} EUR
TVA : ${tva}%
Montant TTC : ${(honoraires * (1 + tva / 100)).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} EUR
Frequence : ${wd.frequence_facturation || "MENSUEL"}
Mode de paiement : ${wd.mode_paiement || "virement"}`,
    });

    const clauses: string[] = [];
    if (wd.clause_lcbft) clauses.push("Clause LCB-FT (lutte contre le blanchiment)");
    if (wd.clause_travail_dissimule) clauses.push("Clause relative au travail dissimule");
    if (wd.clause_rgpd) clauses.push("Clause RGPD (protection des donnees)");
    if (clauses.length > 0) {
      sections.push({
        title: "Clauses reglementaires",
        content: clauses.map((c) => `- ${c}`).join("\n"),
      });
    }

    if (wd.clauses_supplementaires) {
      sections.push({
        title: "Clauses supplementaires",
        content: String(wd.clauses_supplementaires),
      });
    }

    return (
      <div className="space-y-6">
        {sections.map((s, i) => (
          <div key={i}>
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">
              {i + 1}. {s.title}
            </h3>
            <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
    );
  };

  // OPT-30: Footer component
  const renderFooter = () => (
    <footer className="border-t border-slate-200 bg-white mt-12 print:hidden">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-slate-900 dark:text-white" />
            </div>
            <span className="text-xs font-semibold text-slate-600">GRIMY</span>
          </div>
          <div className="text-center text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 space-y-1">
            <p>Signature electronique securisee — Conformite LCB-FT</p>
            <p>Article 1367 du Code civil — Reglement eIDAS</p>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
            {new Date().getFullYear()} GRIMY
          </div>
        </div>
      </div>
    </footer>
  );

  // ── LOADING ──
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 dark:text-slate-500">Chargement du document...</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">Verification du lien de signature</p>
        </div>
      </div>
    );
  }

  // ── EXPIRED (OPT-16: separate from error) ──
  if (state === "expired") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Lien expire</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">{errorMsg}</p>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
              Contactez votre expert-comptable pour recevoir un nouveau lien de signature.
            </div>
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  // ── ERROR ──
  if (state === "error") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Lien invalide</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">{errorMsg}</p>
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  // ── ALREADY SIGNED ──
  if (state === "already_signed") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Document deja signe</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Ce document a ete signe{signer ? ` par ${signer}` : ""}{" "}
              {signedAt ? `le ${formatDate(signedAt)}` : ""}.
            </p>
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  // ── SIGNING (OPT-17: spinner state) ──
  if (state === "signing") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            <Shield className="absolute inset-0 m-auto w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">Signature en cours</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">Veuillez patienter, votre signature est en cours de traitement...</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-2">Ne fermez pas cette page</p>
        </div>
      </div>
    );
  }

  // ── SIGNED (just now) ──
  if (state === "signed") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-lg text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Document signe avec succes</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Signe par <strong>{signerNom}</strong> le {formatDate(signedAt)}
            </p>

            {certificate && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 text-left space-y-2 mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-slate-700">Certificat de signature</h3>
                  {certificate.certificate_id && (
                    <span className="ml-auto text-[9px] font-mono text-slate-400 dark:text-slate-500 dark:text-slate-400">{certificate.certificate_id}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Document</span>
                  <span className="text-slate-700 font-mono">{certificate.document}</span>
                  <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Signataire</span>
                  <span className="text-slate-700">{certificate.signer}</span>
                  {certificate.signer_qualite && (
                    <>
                      <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Qualite</span>
                      <span className="text-slate-700">{certificate.signer_qualite}</span>
                    </>
                  )}
                  <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Email</span>
                  <span className="text-slate-700">{certificate.email}</span>
                  <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Date</span>
                  <span className="text-slate-700">{new Date(certificate.signed_at).toLocaleString("fr-FR")}</span>
                  <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Methode</span>
                  <span className="text-slate-700">{certificate.method}</span>
                  <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Base legale</span>
                  <span className="text-slate-700">{certificate.legal_basis || "Article 1367 du Code civil"}</span>
                  {certificate.document_hash && (
                    <>
                      <span className="text-slate-400 dark:text-slate-500 dark:text-slate-400">Empreinte</span>
                      <span className="text-slate-700 font-mono text-[10px] break-all">{certificate.document_hash}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              {certificateUrl && (
                <a
                  href={certificateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-slate-900 dark:text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" /> Telecharger le certificat
                </a>
              )}
              <Button
                variant="outline"
                onClick={handlePrint}
                className="gap-2 print:hidden"
              >
                <Printer className="w-4 h-4" /> Imprimer
              </Button>
            </div>
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  // ── VIEW & SIGN ──
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* OPT-19: Scroll progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-slate-200 print:hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Header — OPT-24: mobile responsive */}
      <header className="bg-white border-b border-slate-200 sticky top-1 z-40 print:static print:border-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-slate-900 dark:text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-800 truncate">
                Lettre de Mission {instance?.numero || ""}
              </h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400 truncate">
                {instance?.raison_sociale} — {instance?.type_mission}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Signature securisee</span>
          </div>
        </div>
      </header>

      {/* Document body */}
      <main ref={mainRef} className="flex-1 max-w-4xl mx-auto px-4 py-6 sm:py-8 w-full">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">
              Bonjour {clientNom},
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Veuillez prendre connaissance de la lettre de mission ci-dessous puis signer electroniquement en bas de page.
            </p>
          </div>
        </div>

        {/* Document card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {/* Document header */}
          <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Lettre de Mission n{"\u00B0"} {instance?.numero}
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">
                  Creee le {instance?.created_at ? new Date(instance.created_at).toLocaleDateString("fr-FR") : "\u2014"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  En attente de signature
                </div>
                {/* OPT-23: Print button */}
                <button
                  onClick={handlePrint}
                  className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 dark:text-slate-500 dark:text-slate-400 transition-colors print:hidden"
                  title="Imprimer"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Document content */}
          <div className="p-4 sm:p-6 md:p-8">
            {renderDocumentContent()}
          </div>
        </div>

        {/* OPT-22: CGV Accordion */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm mt-4 overflow-hidden print:hidden">
          <button
            onClick={() => setCgvOpen(!cgvOpen)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Conditions generales d'intervention</span>
            </div>
            {cgvOpen ? <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />}
          </button>
          {cgvOpen && (
            <div className="px-4 pb-4 border-t border-slate-100">
              <div className="mt-3 text-xs text-slate-400 dark:text-slate-500 leading-relaxed space-y-2 max-h-64 overflow-y-auto">
                <p>Les presentes conditions generales d'intervention regissent les rapports entre le cabinet d'expertise comptable et son client dans le cadre de la mission definie dans la lettre de mission.</p>
                <p><strong>Obligations du professionnel :</strong> Le cabinet s'engage a accomplir la mission avec diligence et competence, conformement aux normes professionnelles applicables.</p>
                <p><strong>Obligations du client :</strong> Le client s'engage a fournir l'ensemble des pieces et informations necessaires a l'execution de la mission dans les delais convenus.</p>
                <p><strong>Secret professionnel :</strong> Le cabinet est tenu au secret professionnel conformement a l'article 21 de l'ordonnance du 19 septembre 1945.</p>
                <p><strong>Responsabilite :</strong> La responsabilite civile professionnelle du cabinet est couverte par un contrat d'assurance souscrit conformement aux exigences de l'Ordre des experts-comptables.</p>
                <p><strong>Honoraires :</strong> Les honoraires sont fixes d'un commun accord et mentionnes dans la lettre de mission. Ils sont revisables annuellement.</p>
                <p><strong>Resiliation :</strong> Chaque partie peut resilier la mission par lettre recommandee avec accuse de reception, en respectant le preavis prevu dans la lettre de mission.</p>
                <p><strong>LCB-FT :</strong> Conformement aux articles L.561-1 et suivants du Code monetaire et financier, le cabinet est soumis aux obligations de lutte contre le blanchiment de capitaux et le financement du terrorisme.</p>
              </div>
            </div>
          )}
        </div>

        {/* Signature zone */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm mt-4 p-4 sm:p-6 md:p-8 print:hidden">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-500" />
            Signature electronique
          </h3>

          <div className="space-y-4">
            {/* Accept checkbox */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <Checkbox
                id="accept"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="accept" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                J'ai lu et j'accepte les termes de la presente lettre de mission.
              </Label>
            </div>

            {/* OPT-22: CGV accept checkbox */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
              <Checkbox
                id="accept-cgv"
                checked={cgvAccepted}
                onCheckedChange={(v) => setCgvAccepted(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="accept-cgv" className="text-sm text-slate-600 leading-relaxed cursor-pointer">
                J'ai lu et j'accepte les conditions generales d'intervention ci-jointes.
              </Label>
            </div>

            {/* Signer info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="signer-nom" className="text-sm font-medium text-slate-700">
                  Nom complet <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="signer-nom"
                  value={signerNom}
                  onChange={(e) => setSignerNom(e.target.value)}
                  placeholder="Jean DUPONT"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="signer-qualite" className="text-sm font-medium text-slate-700">
                  Qualite
                </Label>
                <Input
                  id="signer-qualite"
                  value={signerQualite}
                  onChange={(e) => setSignerQualite(e.target.value)}
                  placeholder="Gerant, President, Directeur..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Validation summary */}
            {(!accepted || !cgvAccepted || !signerNom.trim()) && (
              <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div>
                  {!accepted && <p>Veuillez accepter les termes de la lettre de mission.</p>}
                  {!cgvAccepted && <p>Veuillez accepter les conditions generales d'intervention.</p>}
                  {!signerNom.trim() && <p>Veuillez renseigner votre nom complet.</p>}
                </div>
              </div>
            )}

            {/* Sign button */}
            <Button
              onClick={handleSign}
              disabled={!accepted || !cgvAccepted || !signerNom.trim()}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-slate-900 dark:text-white py-6 text-base font-semibold disabled:opacity-40"
            >
              <CheckCircle2 className="w-5 h-5" />
              Signer electroniquement
            </Button>

            {/* Legal notice */}
            <div className="flex items-start gap-2 text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400 leading-relaxed">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>
                En cliquant sur "Signer electroniquement", vous acceptez que votre signature
                electronique ait la meme valeur juridique qu'une signature manuscrite conformement
                a l'article 1367 du Code civil et au reglement europeen eIDAS. La signature sera
                horodatee et votre adresse IP sera enregistree a des fins de preuve.
              </p>
            </div>
          </div>
        </div>
      </main>

      {renderFooter()}
    </div>
  );
}
