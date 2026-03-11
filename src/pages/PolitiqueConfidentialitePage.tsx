export default function PolitiqueConfidentialitePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-10">
        <h1 className="text-4xl font-serif font-bold tracking-tight">Politique de Confidentialité</h1>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Responsable du traitement</h2>
          <p className="text-slate-300 leading-relaxed">
            <strong>COMPTADEC</strong><br />
            Siège social : Marseille, France<br />
            Contact : <a href="mailto:contact@grimy.fr" className="text-blue-400 hover:underline">contact@grimy.fr</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Finalités du traitement</h2>
          <p className="text-slate-300 leading-relaxed">
            Les données personnelles collectées sont traitées dans le cadre de la mise à disposition
            de la plateforme LCB-FT Matrice, outil de conformité en matière de lutte contre le
            blanchiment de capitaux et le financement du terrorisme (LCB-FT) à destination des
            cabinets d'expertise comptable. Les finalités principales sont :
          </p>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>Gestion des comptes utilisateurs et authentification</li>
            <li>Mise en œuvre des obligations de vigilance LCB-FT</li>
            <li>Gestion de la facturation et des abonnements</li>
            <li>Amélioration du service et support technique</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Données collectées</h2>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>Données d'identification : nom, prénom, adresse e-mail</li>
            <li>Données professionnelles : numéro SIREN du cabinet, rôle au sein du cabinet</li>
            <li>Données de connexion : adresse IP, journaux d'accès, horodatages</li>
            <li>Données de facturation : traitées par Stripe (nous ne stockons pas les numéros de carte)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Sous-traitants</h2>
          <p className="text-slate-300 leading-relaxed">
            Nous faisons appel aux sous-traitants suivants pour le fonctionnement du service :
          </p>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li><strong>Supabase Inc.</strong> — Base de données, authentification et stockage (hébergement EU)</li>
            <li><strong>Vercel Inc.</strong> — Hébergement de l'application web</li>
            <li><strong>Stripe Inc.</strong> — Traitement des paiements</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            Chaque sous-traitant est lié par des clauses contractuelles conformes au RGPD
            garantissant la protection de vos données.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Durée de conservation</h2>
          <p className="text-slate-300 leading-relaxed">
            Les données personnelles sont conservées pendant la durée de la relation contractuelle,
            puis archivées pendant les durées légales applicables (5 ans pour les données de
            facturation, durée de prescription légale pour les données de conformité LCB-FT).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Vos droits</h2>
          <p className="text-slate-300 leading-relaxed">
            Conformément au RGPD, vous disposez des droits suivants :
          </p>
          <ul className="list-disc list-inside text-slate-300 space-y-1">
            <li>Droit d'accès à vos données personnelles</li>
            <li>Droit de rectification des données inexactes</li>
            <li>Droit à l'effacement (« droit à l'oubli »)</li>
            <li>Droit à la limitation du traitement</li>
            <li>Droit à la portabilité de vos données</li>
            <li>Droit d'opposition au traitement</li>
          </ul>
          <p className="text-slate-300 leading-relaxed">
            Pour exercer ces droits, contactez-nous à{" "}
            <a href="mailto:contact@grimy.fr" className="text-blue-400 hover:underline">contact@grimy.fr</a>.
            Vous pouvez également introduire une réclamation auprès de la CNIL.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Sécurité</h2>
          <p className="text-slate-300 leading-relaxed">
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour
            protéger vos données : chiffrement AES-GCM des données sensibles, isolation par
            cabinet (Row Level Security), journalisation des accès, et authentification sécurisée.
          </p>
        </section>

        <p className="text-sm text-slate-500 pt-8 border-t border-slate-800">
          Dernière mise à jour : mars 2026
        </p>
      </div>
    </div>
  );
}
