import { useState, useEffect } from "react";

const COOKIE_KEY = "cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_KEY);
      if (!consent) setVisible(true);
    } catch {
      // Private browsing or storage unavailable
      setVisible(true);
    }
  }, []);

  const respond = (accepted: boolean) => {
    try { localStorage.setItem(COOKIE_KEY, accepted ? "accepted" : "refused"); } catch { /* storage full */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentement aux cookies"
      aria-describedby="cookie-banner-text"
      className="fixed bottom-0 inset-x-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-white/10 text-sm text-slate-900 dark:text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3"
    >
      <p id="cookie-banner-text">Ce site utilise des cookies pour ameliorer votre experience.</p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => respond(true)}
          aria-label="Accepter les cookies"
          className="px-4 py-1.5 rounded bg-white text-gray-900 font-medium hover:bg-gray-200 transition-colors"
        >
          Accepter
        </button>
        <button
          onClick={() => respond(false)}
          aria-label="Refuser les cookies"
          className="px-4 py-1.5 rounded border border-white/20 hover:bg-white/10 transition-colors"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}
