export default function CGVPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-10">
        <h1 className="text-4xl font-serif font-bold tracking-tight">Conditions Générales de Vente</h1>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-800 dark:text-slate-200">Article 1 — Objet</h2>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Les présentes Conditions Générales de Vente (CGV) régissent l'accès et l'utilisation
            de la plateforme SaaS LCB-FT Matrice, éditée par COMPTADEC, destinée aux cabinets
            d'expertise comptable pour la gestion de leur conformité en matière de lutte contre
            le blanchiment de capitaux et le financement du terrorisme.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-800 dark:text-slate-200">Article 2 — Tarifs</h2>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">Les offres disponibles sont les suivantes :</p>
          <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
            <li><strong>Solo</strong> — 29 € HT / mois : 1 utilisateur, fonctionnalités essentielles</li>
            <li><strong>Pro</strong> — 79 € HT / mois : jusqu'à 10 utilisateurs, fonctionnalités avancées</li>
            <li><strong>Enterprise</strong> — Sur devis : utilisateurs illimités, support dédié, personnalisation</li>
          </ul>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Les prix sont indiqués en euros hors taxes. La TVA applicable sera ajoutée lors de la facturation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-800 dark:text-slate-200">Article 3 — Paiement</h2>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Le paiement s'effectue mensuellement par carte bancaire via notre prestataire de paiement
            sécurisé Stripe. Le prélèvement est effectué automatiquement à chaque date anniversaire
            de l'abonnement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-800 dark:text-slate-200">Article 4 — Durée et résiliation</h2>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            L'abonnement est <strong>sans engagement</strong>. L'utilisateur peut résilier à tout moment
            depuis son espace de paramétrage. La résiliation prend effet à la fin de la période de
            facturation en cours. Aucun remboursement prorata temporis ne sera effectué.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-800 dark:text-slate-200">Article 5 — Limitation de responsabilité</h2>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            COMPTADEC met en œuvre les moyens nécessaires pour assurer la disponibilité et la sécurité
            de la plateforme. Toutefois, COMPTADEC ne saurait être tenue responsable des dommages
            indirects, pertes de données, interruptions de service, ou de toute conséquence liée à
            l'utilisation ou l'impossibilité d'utiliser le service. La plateforme constitue un outil
            d'aide à la conformité et ne se substitue pas aux obligations légales incombant à
            l'utilisateur.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-800 dark:text-slate-200">Article 6 — Données personnelles</h2>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Les données collectées dans le cadre de l'utilisation du service sont traitées conformément
            au Règlement Général sur la Protection des Données (RGPD). Pour plus d'informations,
            consultez notre{" "}
            <a href="/confidentialite" className="text-blue-400 hover:underline">Politique de Confidentialité</a>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-800 dark:text-slate-200">Article 7 — Droit applicable</h2>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            Les présentes CGV sont soumises au droit français. En cas de litige, et après tentative
            de résolution amiable, compétence exclusive est attribuée au <strong>Tribunal de Commerce
            de Marseille</strong>.
          </p>
        </section>

        <p className="text-sm text-slate-400 dark:text-slate-500 pt-8 border-t border-slate-800">
          Dernière mise à jour : mars 2026
        </p>
      </div>
    </div>
  );
}
