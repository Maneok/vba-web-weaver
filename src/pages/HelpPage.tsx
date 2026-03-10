import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Rocket,
  UserPlus,
  FileText,
  AlertTriangle,
  ClipboardCheck,
  HelpCircle,
  ChevronRight,
  Building2,
  CheckCircle2,
  Users,
  ShieldAlert,
  BarChart3,
  FileCheck,
  BookOpen,
  Layers,
  Zap,
  Lock,
  Mail,
  ArrowUpRight,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ─── Section definitions ───────────────────────────────────────────
const SECTIONS = [
  { id: "demarrage", label: "Demarrage rapide", icon: Rocket },
  { id: "parcours", label: "Parcours nouveau client", icon: UserPlus },
  { id: "lettre", label: "Lettre de mission", icon: FileText },
  { id: "registre", label: "Registre LCB-FT", icon: AlertTriangle },
  { id: "controle", label: "Controle qualite", icon: ClipboardCheck },
  { id: "faq", label: "FAQ", icon: HelpCircle },
] as const;

// ─── Quick start steps ─────────────────────────────────────────────
const QUICK_START = [
  {
    step: 1,
    title: "Inscription",
    description: "Creez votre compte avec votre email professionnel ou connectez-vous via Google. Un cabinet est automatiquement cree pour vous.",
    icon: Mail,
  },
  {
    step: 2,
    title: "Configurer le cabinet",
    description: "Rendez-vous dans Parametres pour personnaliser le nom du cabinet, ajouter des collaborateurs et definir les roles (Admin, Superviseur, Collaborateur, Stagiaire).",
    icon: Building2,
  },
  {
    step: 3,
    title: "Creer un client",
    description: "Cliquez sur \"Nouveau Client\" dans la sidebar. Recherchez l'entreprise par SIREN ou raison sociale, puis completez le questionnaire de vigilance.",
    icon: UserPlus,
  },
  {
    step: 4,
    title: "Generer la lettre de mission",
    description: "Depuis l'onglet Lettre de Mission, selectionnez un modele ou generez une lettre personnalisee pour votre client.",
    icon: FileText,
  },
  {
    step: 5,
    title: "Tableau de bord",
    description: "Suivez vos indicateurs cles : clients en retard, alertes actives, taux de conformite. Tout est centralise sur le Dashboard.",
    icon: BarChart3,
  },
];

// ─── Client journey steps ───────────────────────────────────────────
const CLIENT_JOURNEY = [
  {
    step: 1,
    title: "Rechercher une entreprise (SIREN ou nom)",
    description: "Saisissez le numero SIREN (9 chiffres) ou la raison sociale de l'entreprise. Le systeme interroge automatiquement les bases publiques (INSEE, Infogreffe) pour pre-remplir les informations.",
    tip: "Le SIREN donne des resultats plus precis que le nom commercial.",
    icon: Search,
  },
  {
    step: 2,
    title: "Verifier les informations auto-remplies",
    description: "Les champs suivants sont automatiquement remplis : raison sociale, forme juridique, adresse du siege, code NAF, capital social, date de creation. Verifiez et corrigez si necessaire.",
    tip: "Les champs sensibles (IBAN, BIC, CNI) sont chiffres en AES-GCM cote client.",
    icon: CheckCircle2,
  },
  {
    step: 3,
    title: "Beneficiaires effectifs",
    description: "Identifiez les personnes physiques detenant plus de 25 % du capital ou des droits de vote. Renseignez leur identite, pourcentage de detention et mode de controle (direct ou indirect).",
    tip: "Un beneficiaire effectif peut aussi etre une personne exercant un controle par d'autres moyens.",
    icon: Users,
  },
  {
    step: 4,
    title: "Questionnaire de vigilance",
    description: "Repondez aux questions portant sur la nature de l'activite, les pays d'implantation, l'exposition aux PPE (Personnes Politiquement Exposees) et les indicateurs de risque specifiques.",
    tip: "Chaque reponse influe directement sur le score de risque final.",
    icon: ShieldAlert,
  },
  {
    step: 5,
    title: "Score et niveau de vigilance",
    description: "Le score est calcule automatiquement. Il determine le niveau de vigilance applicable : simplifiee (score bas), standard (score moyen) ou renforcee (score eleve). Vous pouvez ajuster manuellement si justifie.",
    tip: "Un score >= 60 declenche automatiquement une vigilance renforcee.",
    icon: BarChart3,
  },
  {
    step: 6,
    title: "Documents et finalisation",
    description: "Telechargez les pieces justificatives requises (Kbis, piece d'identite, justificatif de domicile). Validez la fiche client pour l'ajouter a votre base. Un enregistrement est cree dans le journal d'audit.",
    tip: "Les documents sont stockes de maniere securisee et associes au dossier client.",
    icon: FileCheck,
  },
];

// ─── FAQ ────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    question: "Comment modifier le scoring ?",
    answer: "Ouvrez la fiche du client, puis cliquez sur l'onglet \"Scoring\". Vous pouvez ajuster manuellement le score en fournissant une justification. La modification est tracee dans le journal d'audit. Seuls les profils Admin et Superviseur peuvent modifier le scoring.",
  },
  {
    question: "Comment ajouter un collaborateur ?",
    answer: "Rendez-vous dans Parametres > Gestion des utilisateurs. Cliquez sur \"Inviter\", saisissez l'email du collaborateur et selectionnez son role (Superviseur, Collaborateur ou Stagiaire). Il recevra un email d'invitation avec un lien de connexion.",
  },
  {
    question: "Comment exporter en CSV ?",
    answer: "Depuis la Base Clients ou le Registre LCB-FT, cliquez sur le bouton \"Exporter\" en haut a droite du tableau. Selectionnez le format CSV. L'export inclut toutes les colonnes visibles et respecte les filtres actifs.",
  },
  {
    question: "Qu'est-ce qu'une PPE ?",
    answer: "Une PPE (Personne Politiquement Exposee) est une personne exercant ou ayant exerce une fonction politique, juridictionnelle ou administrative importante (chef d'Etat, ministre, parlementaire, magistrat, etc.). Les PPE et leur entourage font l'objet de mesures de vigilance renforcee selon l'article L.561-10 du Code monetaire et financier.",
  },
  {
    question: "Comment faire une declaration TRACFIN ?",
    answer: "Si vous identifiez une operation suspecte, creez une alerte dans le Registre LCB-FT avec le motif de soupcon. La declaration a TRACFIN se fait via le portail officiel ERMES (ermes.tracfin.gouv.fr). L'application vous aide a documenter les elements de soupcon mais ne transmet pas directement la declaration.",
  },
  {
    question: "Les donnees sont-elles securisees ?",
    answer: "Oui. Les donnees sensibles (IBAN, BIC, CNI) sont chiffrees en AES-GCM cote client avant stockage. L'acces est controle par des politiques RLS (Row Level Security) Supabase avec isolation par cabinet. Chaque action est tracee dans un journal d'audit infalsifiable (INSERT only).",
  },
  {
    question: "Comment changer de mot de passe ?",
    answer: "Cliquez sur votre avatar en haut a droite, puis \"Parametres du compte\". Dans la section Securite, cliquez sur \"Modifier le mot de passe\". Vous recevrez un email de reinitialisation. Vous pouvez aussi utiliser le lien \"Mot de passe oublie\" sur la page de connexion.",
  },
  {
    question: "Comment inviter un collaborateur ?",
    answer: "Allez dans Parametres > Utilisateurs. Cliquez sur \"Inviter un utilisateur\", renseignez son email et choisissez le role souhaite. L'invite recevra un lien par email. Le premier utilisateur du cabinet est automatiquement Admin.",
  },
  {
    question: "Quelle est la difference simplifiee/standard/renforcee ?",
    answer: "Les trois niveaux de vigilance correspondent a l'intensite des mesures de connaissance client (KYC) :\n\n- Simplifiee : client a faible risque, verification allege des documents.\n- Standard : procedure normale avec verification d'identite complete et questionnaire.\n- Renforcee : client a risque eleve (PPE, pays a risque, activite sensible). Necessite des documents supplementaires, une validation hierarchique et un suivi renforce.",
  },
  {
    question: "Comment contacter le support ?",
    answer: "Envoyez un email a support@o90.fr ou utilisez le formulaire de contact dans Parametres > Support. Notre equipe repond sous 24h ouvrables. Pour les urgences liees a la securite, contactez directement securite@o90.fr.",
  },
];

// ─── Searchable content index ───────────────────────────────────────
function buildSearchIndex() {
  const entries: { section: string; title: string; text: string }[] = [];
  QUICK_START.forEach((s) => entries.push({ section: "demarrage", title: s.title, text: `${s.title} ${s.description}` }));
  CLIENT_JOURNEY.forEach((s) => entries.push({ section: "parcours", title: s.title, text: `${s.title} ${s.description} ${s.tip}` }));
  FAQ_ITEMS.forEach((f) => entries.push({ section: "faq", title: f.question, text: `${f.question} ${f.answer}` }));
  entries.push({ section: "lettre", title: "Lettre de mission", text: "lettre mission modele generer template personnaliser" });
  entries.push({ section: "registre", title: "Registre LCB-FT", text: "registre alerte soupcon declaration tracfin qualifier cloturer" });
  entries.push({ section: "controle", title: "Controle qualite", text: "controle qualite tirage aleatoire audit verification" });
  return entries;
}

const SEARCH_INDEX = buildSearchIndex();

// ─── Component ──────────────────────────────────────────────────────
export default function HelpPage() {
  const [activeSection, setActiveSection] = useState("demarrage");
  const [search, setSearch] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Filter search results
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return SEARCH_INDEX.filter((e) => e.text.toLowerCase().includes(q));
  }, [search]);

  // Intersection observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    setSearch("");
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 overflow-hidden ml-0">
      {/* ─── Left nav ─────────────────────────────────── */}
      <nav className="hidden lg:flex w-[240px] shrink-0 flex-col border-r border-white/[0.06] bg-slate-950/60 backdrop-blur-sm">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-100">Documentation</h2>
          </div>
          <p className="text-xs text-slate-500">Guide d'utilisation</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                activeSection === id
                  ? "bg-blue-500/15 text-blue-200"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ─── Main content ─────────────────────────────── */}
      <main className="flex-1 overflow-y-auto scroll-smooth">
        {/* Search bar */}
        <div className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-white/[0.06] px-6 py-3">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Rechercher dans l'aide..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
            />
          </div>

          {/* Search results dropdown */}
          {searchResults && searchResults.length > 0 && (
            <div className="absolute left-6 right-6 top-full mt-1 max-w-xl bg-slate-900 border border-white/[0.08] rounded-lg shadow-xl max-h-64 overflow-y-auto z-20">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(r.section)}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/[0.04] flex items-center gap-2 border-b border-white/[0.04] last:border-0"
                >
                  <ArrowUpRight className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-200">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {SECTIONS.find((s) => s.id === r.section)?.label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchResults && searchResults.length === 0 && (
            <div className="absolute left-6 right-6 top-full mt-1 max-w-xl bg-slate-900 border border-white/[0.08] rounded-lg shadow-xl p-4 z-20">
              <p className="text-sm text-slate-400 text-center">Aucun resultat pour "{search}"</p>
            </div>
          )}
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8 space-y-16">
          {/* ═══ Section 1: Demarrage rapide ═══ */}
          <section id="demarrage" ref={(el) => { sectionRefs.current["demarrage"] = el; }}>
            <SectionHeader icon={Rocket} title="Demarrage rapide" subtitle="5 etapes pour etre operationnel" />
            <div className="space-y-4 mt-6">
              {QUICK_START.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.step} className="bg-white/[0.02] border-white/[0.06] p-4">
                    <div className="flex gap-4">
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 text-blue-400 shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-300">
                            Etape {item.step}
                          </Badge>
                          <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* ═══ Section 2: Parcours nouveau client ═══ */}
          <section id="parcours" ref={(el) => { sectionRefs.current["parcours"] = el; }}>
            <SectionHeader icon={UserPlus} title="Parcours nouveau client" subtitle="De la recherche a la validation" />
            <div className="mt-6 space-y-6">
              {CLIENT_JOURNEY.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="relative">
                    {/* Connector line */}
                    {idx < CLIENT_JOURNEY.length - 1 && (
                      <div className="absolute left-5 top-12 bottom-0 w-px bg-gradient-to-b from-blue-500/20 to-transparent" />
                    )}
                    <div className="flex gap-4">
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 relative z-10">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-300">
                            Etape {item.step}
                          </Badge>
                          <h3 className="text-sm font-semibold text-slate-100">{item.title}</h3>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-2">{item.description}</p>
                        <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2">
                          <Zap className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-200/80">{item.tip}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ═══ Section 3: Lettre de mission ═══ */}
          <section id="lettre" ref={(el) => { sectionRefs.current["lettre"] = el; }}>
            <SectionHeader icon={FileText} title="Lettre de mission" subtitle="Modeles et generation" />
            <div className="mt-6 space-y-4">
              <Card className="bg-white/[0.02] border-white/[0.06] p-5">
                <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" />
                  Onglet "Modele"
                </h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                    Parcourez les modeles de lettres pre-configures (expertise comptable, commissariat aux comptes, etc.)
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                    Chaque modele inclut les mentions obligatoires selon les normes professionnelles
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                    Personnalisez les variables (honoraires, periodicite, missions specifiques)
                  </li>
                </ul>
              </Card>

              <Card className="bg-white/[0.02] border-white/[0.06] p-5">
                <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-400" />
                  Onglet "Generer"
                </h3>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                    Selectionnez un client existant dans votre base pour pre-remplir les informations
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                    Choisissez le modele de base, puis ajustez les clauses selon le besoin
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                    Previsualisation en temps reel avant export au format PDF
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                    La lettre generee est automatiquement archivee dans le module GED
                  </li>
                </ul>
              </Card>
            </div>
          </section>

          {/* ═══ Section 4: Registre LCB-FT ═══ */}
          <section id="registre" ref={(el) => { sectionRefs.current["registre"] = el; }}>
            <SectionHeader icon={AlertTriangle} title="Registre LCB-FT" subtitle="Gestion des alertes et declarations" />
            <div className="mt-6 space-y-4">
              {[
                {
                  title: "Creer une alerte",
                  desc: "Depuis le registre, cliquez sur \"Nouvelle alerte\". Selectionnez le client concerne, la nature du soupcon et decrivez les faits observes. L'alerte est horodatee et tracee.",
                },
                {
                  title: "Qualifier l'alerte",
                  desc: "Analysez les elements, ajoutez des pieces justificatives et qualifiez l'alerte : soupcon confirme, a surveiller ou classee sans suite. Chaque changement de statut est enregistre dans le journal d'audit.",
                },
                {
                  title: "Cloturer",
                  desc: "Une fois l'analyse terminee, cloturez l'alerte avec un motif de cloture. Si le soupcon est confirme, documentez les actions entreprises (declaration TRACFIN, mesures de vigilance renforcee, fin de la relation d'affaires).",
                },
              ].map((item) => (
                <Card key={item.title} className="bg-white/[0.02] border-white/[0.06] p-4">
                  <h3 className="text-sm font-semibold text-slate-100 mb-1.5 flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-orange-400" />
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed pl-6">{item.desc}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* ═══ Section 5: Controle qualite ═══ */}
          <section id="controle" ref={(el) => { sectionRefs.current["controle"] = el; }}>
            <SectionHeader icon={ClipboardCheck} title="Controle qualite" subtitle="Tirage aleatoire et audits" />
            <div className="mt-6">
              <Card className="bg-white/[0.02] border-white/[0.06] p-5">
                <div className="space-y-4 text-sm text-slate-400">
                  <p>Le module de controle qualite permet de realiser des audits internes conformement aux obligations du reglement interieur LCB-FT.</p>
                  <Separator className="bg-white/[0.06]" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 mb-2">Tirage aleatoire</h3>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                        Cliquez sur "Lancer un tirage" pour selectionner aleatoirement un echantillon de dossiers clients
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                        Definissez le pourcentage de dossiers a controler (recommande : 10-20 % par an)
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                        Pour chaque dossier tire, verifiez la completude des pieces, la coherence du scoring et la mise a jour des informations
                      </li>
                      <li className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                        Redigez un rapport de controle avec vos observations et recommandations
                      </li>
                    </ul>
                  </div>
                  <Separator className="bg-white/[0.06]" />
                  <div className="flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/10 px-3 py-2">
                    <Lock className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-200/80">
                      Seuls les profils Admin et Superviseur peuvent lancer un tirage et valider les rapports de controle.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* ═══ Section 6: FAQ ═══ */}
          <section id="faq" ref={(el) => { sectionRefs.current["faq"] = el; }}>
            <SectionHeader icon={HelpCircle} title="Questions frequentes" subtitle="10 reponses aux questions les plus courantes" />
            <div className="mt-6">
              <Accordion type="multiple" className="space-y-2">
                {FAQ_ITEMS.map((item, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="border border-white/[0.06] rounded-lg bg-white/[0.02] px-4 data-[state=open]:bg-white/[0.03]"
                  >
                    <AccordionTrigger className="text-sm text-slate-200 hover:text-slate-100 py-3 hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-slate-400 leading-relaxed pb-4 whitespace-pre-line">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          {/* Bottom spacer */}
          <div className="h-16" />
        </div>
      </main>
    </div>
  );
}

// ─── Reusable section header ────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-blue-500/10 text-blue-400">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}
