import { useState, useEffect } from "react";

const COOKIE_KEY = "cookie-consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) setVisible(true);
  }, []);

  const respond = (accepted: boolean) => {
    try { localStorage.setItem(COOKIE_KEY, accepted ? "accepted" : "refused"); } catch { /* storage full */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gray-900 border-t border-white/10 text-sm text-white px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
      <p>Ce site utilise des cookies pour ameliorer votre experience.</p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={() => respond(true)}
          className="px-4 py-1.5 rounded bg-white text-gray-900 font-medium hover:bg-gray-200 transition-colors"
        >
          Accepter
        </button>
        <button
          onClick={() => respond(false)}
          className="px-4 py-1.5 rounded border border-white/20 hover:bg-white/10 transition-colors"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}
