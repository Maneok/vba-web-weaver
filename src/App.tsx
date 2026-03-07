import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { AppProvider } from "@/lib/AppContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import BddPage from "@/pages/BddPage";
import GouvernancePage from "@/pages/GouvernancePage";
import ControlePage from "@/pages/ControlePage";
import RegistrePage from "@/pages/RegistrePage";
import LogsPage from "@/pages/LogsPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AuditTrailPage from "@/pages/AuditTrailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <AppProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/bdd" element={<BddPage />} />
                <Route path="/gouvernance" element={<GouvernancePage />} />
                <Route path="/controle" element={<ControlePage />} />
                <Route path="/registre" element={<RegistrePage />} />
                <Route path="/logs" element={<LogsPage />} />
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute requiredPermission="manage_users">
                      <AdminUsersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/audit"
                  element={
                    <ProtectedRoute requiredPermission="view_audit">
                      <AuditTrailPage />
                    </ProtectedRoute>
                  }
                />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
