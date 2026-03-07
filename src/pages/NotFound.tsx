import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-7xl font-bold text-blue-500/20 mb-2">404</p>
        <h1 className="text-xl font-bold text-white mb-2">Page introuvable</h1>
        <p className="text-sm text-slate-500 mb-6">La page demandee n'existe pas.</p>
        <a href="/" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          Retour au dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;
