import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Shield, LayoutDashboard, Building2, AlertTriangle, CreditCard, Megaphone, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminOverview from "@/components/admin/AdminOverview";
import AdminCabinets from "@/components/admin/AdminCabinets";
import AdminUnpaid from "@/components/admin/AdminUnpaid";
import AdminPayments from "@/components/admin/AdminPayments";
import AdminBroadcasts from "@/components/admin/AdminBroadcasts";
import AdminSettings from "@/components/admin/AdminSettings";

type TabId = "overview" | "cabinets" | "unpaid" | "payments" | "broadcasts" | "settings";

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof Shield;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "cabinets", label: "Cabinets", icon: Building2 },
  { id: "unpaid", label: "Impayes", icon: AlertTriangle },
  { id: "payments", label: "Paiements", icon: CreditCard },
  { id: "broadcasts", label: "Communications", icon: Megaphone },
  { id: "settings", label: "Parametres", icon: Settings },
];

export default function SuperAdminPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [unpaidCount, setUnpaidCount] = useState(0);

  // Redirect if not super admin
  useEffect(() => {
    if (profile && !profile.is_super_admin) {
      navigate("/", { replace: true });
    }
  }, [profile, navigate]);

  // Fetch unpaid count for badge
  useEffect(() => {
    async function fetchUnpaidCount() {
      try {
        const { data } = await supabase.rpc("admin_list_unpaid");
        if (data && Array.isArray(data)) {
          setUnpaidCount(data.length);
        }
      } catch {
        // Silently ignore
      }
    }
    fetchUnpaidCount();
  }, []);

  if (!profile?.is_super_admin) {
    return null;
  }

  return (
    <div className="p-4 lg:p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl border border-blue-500/20">
          <Shield className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Super Admin GRIMY</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">Gestion globale de la plateforme</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-blue-500/20 text-blue-300 shadow-sm"
                  : "text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === "unpaid" && unpaidCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-slate-900 dark:text-white min-w-[18px] text-center">
                  {unpaidCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && <AdminOverview />}
        {activeTab === "cabinets" && <AdminCabinets />}
        {activeTab === "unpaid" && <AdminUnpaid />}
        {activeTab === "payments" && <AdminPayments />}
        {activeTab === "broadcasts" && <AdminBroadcasts />}
        {activeTab === "settings" && <AdminSettings />}
      </div>
    </div>
  );
}
