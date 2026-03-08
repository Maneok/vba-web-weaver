import { Suspense, lazy } from "react";
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
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for code splitting
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
const AdminUsersPage = lazy(() => import("@/pages/AdminUsersPage"));
const PricingPage = lazy(() => import("@/pages/PricingPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
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
    <TooltipProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/landing" element={<LazyPage><LandingPage /></LazyPage>} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/pricing" element={<LazyPage><PricingPage /></LazyPage>} />
                <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route index element={<LazyPage><DashboardPage /></LazyPage>} />
                  <Route path="bdd" element={<LazyPage><BddPage /></LazyPage>} />
                  <Route path="nouveau-client" element={<LazyPage><NouveauClientPage /></LazyPage>} />
                  <Route path="client/:ref" element={<LazyPage><ClientDetailPage /></LazyPage>} />
                  <Route path="gouvernance" element={<LazyPage><GouvernancePage /></LazyPage>} />
                  <Route path="controle" element={<LazyPage><ControlePage /></LazyPage>} />
                  <Route path="registre" element={<LazyPage><RegistrePage /></LazyPage>} />
                  <Route path="logs" element={<LazyPage><LogsPage /></LazyPage>} />
                  <Route path="ged" element={<LazyPage><GedPage /></LazyPage>} />
                  <Route path="lettre-mission" element={<LazyPage><LettreMissionPage /></LazyPage>} />
                  <Route path="lettre-mission/:ref" element={<LazyPage><LettreMissionPage /></LazyPage>} />
                  <Route path="diagnostic" element={<LazyPage><DiagnosticPage /></LazyPage>} />
                  <Route path="parametres" element={<LazyPage><SettingsPage /></LazyPage>} />
                  <Route path="aide" element={<LazyPage><HelpPage /></LazyPage>} />
                  <Route path="admin/users" element={<LazyPage><AdminUsersPage /></LazyPage>} />
                  <Route path="settings" element={<Navigate to="/parametres" replace />} />
                  <Route path="dashboard" element={<Navigate to="/" replace />} />
                </Route>
                <Route path="*" element={<LazyPage><NotFound /></LazyPage>} />
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
