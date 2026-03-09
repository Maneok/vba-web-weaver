import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/lib/AppContext";
import { AuthProvider } from "@/lib/auth/AuthContext";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageErrorBoundary from "@/components/PageErrorBoundary";
import AuthPage from "@/pages/AuthPage";

// Lazy-loaded pages — code split per route
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const BddPage = lazy(() => import("@/pages/BddPage"));
const GouvernancePage = lazy(() => import("@/pages/GouvernancePage"));
const ControlePage = lazy(() => import("@/pages/ControlePage"));
const RegistrePage = lazy(() => import("@/pages/RegistrePage"));
const LogsPage = lazy(() => import("@/pages/LogsPage"));
const NouveauClientPage = lazy(() => import("@/pages/NouveauClientPage"));
const ClientDetailPage = lazy(() => import("@/pages/ClientDetailPage"));
const DiagnosticPage = lazy(() => import("@/pages/DiagnosticPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const GedPage = lazy(() => import("@/pages/GedPage"));
const LettreMissionPage = lazy(() => import("@/pages/LettreMissionPage"));
const HelpPage = lazy(() => import("@/pages/HelpPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 animate-fade-in-up">
      <div className="relative">
        <div className="h-8 w-8 border-2 border-blue-500/30 rounded-full" />
        <div className="absolute inset-0 h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-xs text-slate-500">Chargement...</p>
    </div>
  );
}

/** Wrap each route in Suspense + ErrorBoundary */
function SafePage({ children }: { children: ReactNode }) {
  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </PageErrorBoundary>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={300}>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/landing" element={<SafePage><LandingPage /></SafePage>} />
                <Route path="/auth" element={<SafePage><AuthPage /></SafePage>} />
                <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route index element={<SafePage><DashboardPage /></SafePage>} />
                  <Route path="bdd" element={<SafePage><BddPage /></SafePage>} />
                  <Route path="nouveau-client" element={<SafePage><NouveauClientPage /></SafePage>} />
                  <Route path="client/:ref" element={<SafePage><ClientDetailPage /></SafePage>} />
                  <Route path="gouvernance" element={<SafePage><GouvernancePage /></SafePage>} />
                  <Route path="controle" element={<SafePage><ControlePage /></SafePage>} />
                  <Route path="registre" element={<SafePage><RegistrePage /></SafePage>} />
                  <Route path="logs" element={<SafePage><LogsPage /></SafePage>} />
                  <Route path="ged" element={<SafePage><GedPage /></SafePage>} />
                  <Route path="lettre-mission" element={<SafePage><LettreMissionPage /></SafePage>} />
                  <Route path="lettre-mission/:ref" element={<SafePage><LettreMissionPage /></SafePage>} />
                  <Route path="diagnostic" element={<SafePage><DiagnosticPage /></SafePage>} />
                  <Route path="parametres" element={<SafePage><SettingsPage /></SafePage>} />
                  <Route path="aide" element={<SafePage><HelpPage /></SafePage>} />
                  <Route path="settings" element={<Navigate to="/parametres" replace />} />
                  <Route path="dashboard" element={<Navigate to="/" replace />} />
                </Route>
                <Route path="*" element={<SafePage><NotFound /></SafePage>} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
      <Toaster />
      <Sonner richColors position="bottom-right" closeButton />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
