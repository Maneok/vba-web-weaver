export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-10">
        <h1 className="text-4xl font-serif font-bold tracking-tight">Mentions Légales</h1>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Éditeur du site</h2>
          <p className="text-slate-300 leading-relaxed">
            <strong>COMPTADEC</strong><br />
            Siège social : Marseille, France<br />
            Directeur de la publication : Alexandre DAHAN<br />
            Contact : <a href="mailto:contact@grimy.fr" className="text-blue-400 hover:underline">contact@grimy.fr</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Hébergement</h2>
          <p className="text-slate-300 leading-relaxed">
            <strong>Vercel Inc.</strong><br />
            440 N Barranca Ave #4133, Covina, CA 91723, États-Unis<br />
            Site web : vercel.com
          </p>
          <p className="text-slate-300 leading-relaxed">
            <strong>Supabase Inc.</strong><br />
            970 Toa Payoh North #07-04, Singapore 318992<br />
            Site web : supabase.com
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Propriété intellectuelle</h2>
          <p className="text-slate-300 leading-relaxed">
            L'ensemble du contenu de ce site (textes, images, logos, icônes, logiciels) est la propriété
            exclusive de COMPTADEC ou de ses partenaires et est protégé par les lois françaises et
            internationales relatives à la propriété intellectuelle. Toute reproduction, représentation,
            modification ou exploitation non autorisée est interdite.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Responsabilité</h2>
          <p className="text-slate-300 leading-relaxed">
            COMPTADEC s'efforce d'assurer l'exactitude des informations diffusées sur ce site.
            Toutefois, elle ne peut garantir l'exhaustivité ni l'absence d'erreurs. L'utilisation
            des informations et contenus disponibles sur ce site se fait sous la seule responsabilité
            de l'utilisateur.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-serif font-semibold text-slate-200">Données personnelles</h2>
          <p className="text-slate-300 leading-relaxed">
            Pour toute question relative à vos données personnelles, consultez notre{" "}
            <a href="/confidentialite" className="text-blue-400 hover:underline">Politique de Confidentialité</a>.
          </p>
        </section>

        <p className="text-sm text-slate-500 pt-8 border-t border-slate-800">
          Dernière mise à jour : mars 2026
        </p>
      </div>
    </div>
  );
}
