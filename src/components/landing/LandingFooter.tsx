import { Link } from "react-router-dom";

const columns = [
  {
    title: "Produit",
    links: [
      { label: "Fonctionnalités", href: "#fonctionnalites" },
      { label: "Tarifs", href: "#tarifs" },
      { label: "Démo", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Ressources",
    links: [
      { label: "Documentation", href: "#" },
      { label: "Guide LCB-FT", href: "#" },
      { label: "Blog", href: "#" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "#" },
      { label: "Contact", href: "#" },
      { label: "CGV", href: "#" },
      { label: "Mentions légales", href: "#" },
    ],
  },
  {
    title: "Conformité",
    links: [
      { label: "NPLAB", href: "#" },
      { label: "NPMQ", href: "#" },
      { label: "RGPD", href: "#" },
      { label: "Sécurité", href: "#" },
    ],
  },
];

export default function LandingFooter() {
  const handleAnchor = (href: string) => {
    if (href.startsWith("#") && href.length > 1) {
      const el = document.querySelector(href);
      el?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="border-t border-white/[0.06] py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-white text-sm font-semibold mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      onClick={(e) => {
                        if (link.href.startsWith("#")) {
                          e.preventDefault();
                          handleAnchor(link.href);
                        }
                      }}
                      className="text-white/40 text-sm hover:text-white/70 transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">
            © 2026 GRIMY — Conformité LCB-FT pour experts-comptables
          </p>
          <div className="flex items-center gap-4">
            {/* LinkedIn */}
            <a href="#" className="text-white/30 hover:text-white/60 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            {/* X / Twitter */}
            <a href="#" className="text-white/30 hover:text-white/60 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
