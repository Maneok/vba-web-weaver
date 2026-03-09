import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "@/lib/AppContext";
import { AuthProvider } from "@/lib/auth/AuthContext";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
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
const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route index element={<DashboardPage />} />
                  <Route path="bdd" element={<BddPage />} />
                  <Route path="nouveau-client" element={<NouveauClientPage />} />
                  <Route path="client/:ref" element={<ClientDetailPage />} />
                  <Route path="gouvernance" element={<GouvernancePage />} />
                  <Route path="controle" element={<ControlePage />} />
                  <Route path="registre" element={<RegistrePage />} />
                  <Route path="logs" element={<LogsPage />} />
                  <Route path="ged" element={<GedPage />} />
                  <Route path="lettre-mission" element={<LettreMissionPage />} />
                  <Route path="lettre-mission/:ref" element={<LettreMissionPage />} />
                  <Route path="diagnostic" element={<DiagnosticPage />} />
                  <Route path="parametres" element={<SettingsPage />} />
                  <Route path="aide" element={<HelpPage />} />
                  <Route path="settings" element={<Navigate to="/parametres" replace />} />
                  <Route path="dashboard" element={<Navigate to="/" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
      <Toaster />
      <Sonner />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
