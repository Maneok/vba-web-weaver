import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Activity,
  Server,
  Wifi,
  AlertTriangle,
  Clock,
  Mail,
  HardDrive,
  Users,
  Download,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  Pause,
  Zap,
  Globe,
  CreditCard,
  FileText,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";

/* ─── Types ─── */

interface HealthCheck {
  id: string;
  service: string;
  status: string;
  response_time_ms: number | null;
  error_message: string | null;
  checked_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  cabinet_id: string | null;
  user_email: string | null;
  created_at: string;
  old_data: unknown;
  new_data: unknown;
}

interface LoginEntry {
  id: string;
  email: string | null;
  cabinet_id: string | null;
  created_at: string;
  ip_address: string | null;
  success: boolean | null;
  user_agent: string | null;
  login_method: string | null;
}

interface ActiveSession {
  id: string;
  user_id: string;
  cabinet_id: string | null;
  last_activity: string | null;
  device_info: string | null;
}

interface UptimePoint {
  hour: string;
  service: string;
  uptime: number;
}

interface ResponseTimePoint {
  day: string;
  service: string;
  avg_ms: number;
}

interface EmailMetrics {
  sent: number;
  pending: number;
  error: number;
}

interface StorageBucket {
  bucket_id: string;
  file_count: number;
  total_bytes: number;
}

/* ─── Constants ─── */

const SERVICES = [
  { key: "supabase", label: "Supabase", icon: Server, color: "emerald" },
  { key: "edge_functions", label: "Edge Functions", icon: Zap, color: "blue" },
  { key: "stripe", label: "Stripe", icon: CreditCard, color: "purple" },
  { key: "inpi", label: "INPI", icon: FileText, color: "amber" },
  { key: "app", label: "App Vercel", icon: Globe, color: "cyan" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  up: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  degraded: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  down: "bg-red-500/20 text-red-300 border-red-500/30",
};

const STATUS_DOT: Record<string, string> = {
  up: "bg-emerald-400",
  degraded: "bg-amber-400",
  down: "bg-red-400",
};

const CHART_COLORS: Record<string, string> = {
  supabase: "#34d399",
  edge_functions: "#60a5fa",
  stripe: "#a78bfa",
  inpi: "#fbbf24",
  app: "#22d3ee",
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Skeleton ─── */
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />;
}

/* ─── Component ─── */

export default function AdminMonitoring({ onAlertCount }: { onAlertCount?: (n: number) => void }) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  // Data states
  const [latestChecks, setLatestChecks] = useState<HealthCheck[]>([]);
  const [incidents, setIncidents] = useState<HealthCheck[]>([]);
  const [uptimeData, setUptimeData] = useState<UptimePoint[]>([]);
  const [responseTimeData, setResponseTimeData] = useState<ResponseTimePoint[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [emailMetrics, setEmailMetrics] = useState<EmailMetrics>({ sent: 0, pending: 0, error: 0 });
  const [storageBuckets, setStorageBuckets] = useState<StorageBucket[]>([]);
  const [lastMaintenance, setLastMaintenance] = useState<HealthCheck | null>(null);
  const [edgeFnStats, setEdgeFnStats] = useState<{ name: string; lastSuccess: string | null; errors24h: number }[]>([]);

  // Filters
  const [logCabinetFilter, setLogCabinetFilter] = useState("");
  const [logActionFilter, setLogActionFilter] = useState("");

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch all data ───
  const fetchAll = useCallback(async () => {
    try {
      const [
        latestRes,
        incidentRes,
        uptimeRes,
        rtRes,
        auditRes,
        loginRes,
        sessionRes,
        emailRes,
        storageRes,
        maintenanceRes,
        edgeFnRes,
      ] = await Promise.all([
        // 1. Latest health checks per service
        supabase
          .from("health_checks")
          .select("*")
          .order("checked_at", { ascending: false })
          .limit(50),

        // 5. Incidents
        supabase
          .from("health_checks")
          .select("*")
          .neq("status", "up")
          .order("checked_at", { ascending: false })
          .limit(50),

        // 3. Uptime 7 days
        supabase.rpc("admin_uptime_7d").then((r) => r),

        // 4. Response time 30 days
        supabase.rpc("admin_response_time_30d").then((r) => r),

        // 7. Audit logs
        supabase
          .from("audit_trail")
          .select("id, action, cabinet_id, user_email, created_at, old_data, new_data")
          .order("created_at", { ascending: false })
          .limit(100),

        // 12. Login history
        supabase
          .from("login_history")
          .select("id, email, cabinet_id, created_at, ip_address, success, user_agent, login_method")
          .order("created_at", { ascending: false })
          .limit(20),

        // 13. Active sessions
        supabase
          .from("active_sessions")
          .select("id, user_id, cabinet_id, last_activity, device_info")
          .order("last_activity", { ascending: false }),

        // 9. Email metrics
        supabase.rpc("admin_email_metrics").then((r) => r),

        // 11. Storage
        supabase.rpc("admin_storage_stats").then((r) => r),

        // 10. Last maintenance
        supabase
          .from("health_checks")
          .select("*")
          .eq("service", "daily-maintenance")
          .order("checked_at", { ascending: false })
          .limit(1),

        // 6. Edge function stats
        supabase.rpc("admin_edge_fn_stats").then((r) => r),
      ]);

      // Process latest checks — keep only most recent per service
      if (latestRes.data) {
        const map = new Map<string, HealthCheck>();
        for (const row of latestRes.data as HealthCheck[]) {
          if (!map.has(row.service)) map.set(row.service, row);
        }
        setLatestChecks(Array.from(map.values()));
      }

      if (incidentRes.data) setIncidents(incidentRes.data as HealthCheck[]);

      // Uptime data — may come from RPC or fallback
      if (uptimeRes.data && Array.isArray(uptimeRes.data)) {
        setUptimeData(
          (uptimeRes.data as { service: string; h: string; uptime: number }[]).map((r) => ({
            hour: new Date(r.h).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit" }),
            service: r.service,
            uptime: Math.round(r.uptime * 100),
          }))
        );
      }

      if (rtRes.data && Array.isArray(rtRes.data)) {
        setResponseTimeData(
          (rtRes.data as { service: string; d: string; avg_ms: number }[]).map((r) => ({
            day: new Date(r.d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
            service: r.service,
            avg_ms: Math.round(r.avg_ms),
          }))
        );
      }

      if (auditRes.data) setAuditLogs(auditRes.data as AuditEntry[]);
      if (loginRes.data) setLoginHistory(loginRes.data as LoginEntry[]);
      if (sessionRes.data) setActiveSessions(sessionRes.data as ActiveSession[]);

      if (emailRes.data && typeof emailRes.data === "object") {
        const d = emailRes.data as Record<string, number>;
        setEmailMetrics({ sent: d.sent ?? 0, pending: d.pending ?? 0, error: d.error ?? 0 });
      }

      if (storageRes.data && Array.isArray(storageRes.data)) {
        setStorageBuckets(
          (storageRes.data as { bucket_id: string; file_count: number; total_bytes: number }[]).map((r) => ({
            bucket_id: r.bucket_id,
            file_count: r.file_count,
            total_bytes: r.total_bytes ?? 0,
          }))
        );
      }

      if (maintenanceRes.data && (maintenanceRes.data as HealthCheck[]).length > 0) {
        setLastMaintenance((maintenanceRes.data as HealthCheck[])[0]);
      }

      if (edgeFnRes.data && Array.isArray(edgeFnRes.data)) {
        setEdgeFnStats(
          (edgeFnRes.data as { name: string; last_success: string | null; errors_24h: number }[]).map((r) => ({
            name: r.name,
            lastSuccess: r.last_success,
            errors24h: r.errors_24h,
          }))
        );
      }

      setLastRefresh(Date.now());
    } catch (err) {
      console.error("[AdminMonitoring] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 15. Auto-refresh
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchAll, 60_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchAll]);

  // 8. Alert count — bubble up for tab badge
  const alertCount = useMemo(() => {
    const downServices = latestChecks.filter((c) => c.status === "down").length;
    const emailErrors = emailMetrics.error;
    return downServices + emailErrors;
  }, [latestChecks, emailMetrics]);

  useEffect(() => {
    onAlertCount?.(alertCount);
  }, [alertCount, onAlertCount]);

  // 2. Test live
  const handleTestLive = async () => {
    setTesting(true);
    try {
      const results: { service: string; status: string; ms: number }[] = [];
      for (const svc of SERVICES) {
        const start = performance.now();
        try {
          if (svc.key === "supabase") {
            await supabase.from("health_checks").select("id").limit(1);
            results.push({ service: svc.key, status: "up", ms: Math.round(performance.now() - start) });
          } else if (svc.key === "app") {
            await fetch("/", { method: "HEAD" });
            results.push({ service: svc.key, status: "up", ms: Math.round(performance.now() - start) });
          } else if (svc.key === "edge_functions") {
            const { error } = await supabase.functions.invoke("sanctions-check", {
              body: { healthCheck: true },
            });
            results.push({
              service: svc.key,
              status: error ? "degraded" : "up",
              ms: Math.round(performance.now() - start),
            });
          } else if (svc.key === "stripe") {
            const { error } = await supabase.functions.invoke("stripe-webhook", {
              body: { healthCheck: true },
            });
            results.push({
              service: svc.key,
              status: error ? "degraded" : "up",
              ms: Math.round(performance.now() - start),
            });
          } else if (svc.key === "inpi") {
            const { error } = await supabase.functions.invoke("inpi-documents", {
              body: { healthCheck: true },
            });
            results.push({
              service: svc.key,
              status: error ? "degraded" : "up",
              ms: Math.round(performance.now() - start),
            });
          }
        } catch {
          results.push({ service: svc.key, status: "down", ms: Math.round(performance.now() - start) });
        }
      }

      // Insert results into health_checks
      const inserts = results.map((r) => ({
        service: r.service,
        status: r.status,
        response_time_ms: r.ms,
        checked_at: new Date().toISOString(),
      }));
      await supabase.from("health_checks").insert(inserts);

      // 17. If any service is down, create notification
      const downSvcs = results.filter((r) => r.status === "down");
      if (downSvcs.length > 0 && profile) {
        await supabase.from("notifications").insert(
          downSvcs.map((d) => ({
            type: "ALERTE_SYSTEME",
            titre: `Service ${d.service} indisponible`,
            message: `Le service ${d.service} est DOWN (test manuel). Temps de reponse : ${d.ms}ms.`,
            priority: "high",
            user_id: profile.id,
            cabinet_id: profile.cabinet_id,
          }))
        );
      }

      const downCount = results.filter((r) => r.status !== "up").length;
      if (downCount === 0) {
        toast.success("Tous les services sont operationnels");
      } else {
        toast.warning(`${downCount} service(s) en anomalie`);
      }

      await fetchAll();
    } catch (err) {
      toast.error("Erreur lors du test");
      console.error(err);
    } finally {
      setTesting(false);
    }
  };

  // 10. Trigger maintenance
  const handleRunMaintenance = async () => {
    try {
      const { error } = await supabase.functions.invoke("daily-maintenance", { body: {} });
      if (error) throw error;
      toast.success("Maintenance lancee avec succes");
      await fetchAll();
    } catch {
      toast.error("Echec de la maintenance");
    }
  };

  // 16. Export CSV
  const handleExportLogs = () => {
    const headers = ["Date", "Cabinet", "Utilisateur", "Action", "Details"];
    const rows = filteredAuditLogs.map((l) => [
      new Date(l.created_at).toISOString(),
      l.cabinet_id ?? "",
      l.user_email ?? "",
      l.action,
      JSON.stringify(l.new_data ?? ""),
    ]);
    downloadCsv(`logs_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success("Export CSV telecharge");
  };

  const handleExportHealthChecks = () => {
    const headers = ["Date", "Service", "Status", "Temps (ms)", "Erreur"];
    const rows = incidents.map((i) => [
      new Date(i.checked_at).toISOString(),
      i.service,
      i.status,
      String(i.response_time_ms ?? ""),
      i.error_message ?? "",
    ]);
    downloadCsv(`health_checks_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success("Export CSV telecharge");
  };

  // 7. Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((l) => {
      if (logCabinetFilter && l.cabinet_id !== logCabinetFilter) return false;
      if (logActionFilter && !l.action.toLowerCase().includes(logActionFilter.toLowerCase())) return false;
      return true;
    });
  }, [auditLogs, logCabinetFilter, logActionFilter]);

  // Unique cabinet IDs for filter
  const cabinetIds = useMemo(() => {
    const set = new Set(auditLogs.map((l) => l.cabinet_id).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [auditLogs]);

  // Chart data transformations
  const uptimeChartData = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const pt of uptimeData) {
      const existing = map.get(pt.hour) ?? { hour: pt.hour as unknown as number };
      (existing as Record<string, unknown>)["hour"] = pt.hour;
      (existing as Record<string, unknown>)[pt.service] = pt.uptime;
      map.set(pt.hour, existing);
    }
    return Array.from(map.values());
  }, [uptimeData]);

  const rtChartData = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const pt of responseTimeData) {
      const existing = map.get(pt.day) ?? {};
      existing["day"] = pt.day;
      existing[pt.service] = pt.avg_ms;
      map.set(pt.day, existing);
    }
    return Array.from(map.values());
  }, [responseTimeData]);

  // 14. Error rate per edge function
  const errorRateData = useMemo(() => {
    return edgeFnStats
      .filter((e) => e.errors24h > 0)
      .sort((a, b) => b.errors24h - a.errors24h)
      .slice(0, 10);
  }, [edgeFnStats]);

  // Service status helper
  const getServiceCheck = (key: string) => latestChecks.find((c) => c.service === key);

  const secondsSinceRefresh = Math.floor((Date.now() - lastRefresh) / 1000);

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ Top bar: alerts + auto-refresh + actions ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 8. Alert count */}
        {alertCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            {alertCount} alerte{alertCount > 1 ? "s" : ""} active{alertCount > 1 ? "s" : ""}
          </div>
        )}

        {/* 15. Auto-refresh indicator */}
        <div className="flex items-center gap-2 ml-auto text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          Derniere maj : il y a {secondsSinceRefresh}s
          <button
            onClick={() => setAutoRefresh((p) => !p)}
            className={`ml-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              autoRefresh ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-400"
            }`}
          >
            {autoRefresh ? "Auto ON" : "Auto OFF"}
          </button>
        </div>

        {/* 2. Test live button */}
        <button
          onClick={handleTestLive}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/30 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {testing ? "Test en cours..." : "Tester maintenant"}
        </button>

        <button
          onClick={() => fetchAll()}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
          title="Rafraichir"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ═══ 1. Service status cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {SERVICES.map((svc) => {
          const check = getServiceCheck(svc.key);
          const status = check?.status ?? "unknown";
          const Icon = svc.icon;
          const dotColor = STATUS_DOT[status] ?? "bg-slate-400";
          return (
            <div
              key={svc.key}
              className="relative rounded-xl bg-white/5 border border-white/10 p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5 text-slate-400" />
                <span className={`w-2.5 h-2.5 rounded-full ${dotColor} ${status === "up" ? "" : "animate-pulse"}`} />
              </div>
              <p className="text-sm font-medium text-slate-200">{svc.label}</p>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    STATUS_COLORS[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"
                  }`}
                >
                  {status}
                </span>
                {check?.response_time_ms != null && (
                  <span className="text-[11px] text-slate-500">{check.response_time_ms}ms</span>
                )}
              </div>
              {check && (
                <p className="text-[10px] text-slate-600 mt-auto">{formatRelative(check.checked_at)}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ Row: Email metrics + Sessions + Storage ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 9. Email metrics */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Emails</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">{emailMetrics.sent}</p>
              <p className="text-[10px] text-slate-500">Envoyes</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-400">{emailMetrics.pending}</p>
              <p className="text-[10px] text-slate-500">En attente</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-400">{emailMetrics.error}</p>
              <p className="text-[10px] text-slate-500">En erreur</p>
            </div>
          </div>
        </div>

        {/* 13. Active sessions */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Sessions actives</h3>
            <span className="ml-auto text-xs font-bold text-blue-400">{activeSessions.length}</span>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {activeSessions.slice(0, 8).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 truncate max-w-[120px]">{s.user_id.slice(0, 8)}...</span>
                <span className="text-slate-500">{s.last_activity ? formatRelative(s.last_activity) : "—"}</span>
              </div>
            ))}
            {activeSessions.length === 0 && <p className="text-[11px] text-slate-600">Aucune session</p>}
          </div>
        </div>

        {/* 11. Storage */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <HardDrive className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Stockage</h3>
          </div>
          <div className="space-y-2">
            {storageBuckets.length > 0 ? (
              storageBuckets.map((b) => (
                <div key={b.bucket_id} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">{b.bucket_id}</span>
                  <span className="text-slate-500">
                    {b.file_count} fichiers · {formatBytes(b.total_bytes)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-600">Aucune donnee</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ 10. Last maintenance ═══ */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex flex-wrap items-center gap-4">
        <Activity className="h-5 w-5 text-slate-400" />
        <div>
          <p className="text-sm font-medium text-slate-200">Derniere maintenance</p>
          {lastMaintenance ? (
            <p className="text-xs text-slate-500">
              {formatDate(lastMaintenance.checked_at)} — {lastMaintenance.status === "up" ? "Succes" : "Echec"}
              {lastMaintenance.response_time_ms != null && ` (${lastMaintenance.response_time_ms}ms)`}
            </p>
          ) : (
            <p className="text-xs text-slate-600">Aucune execution enregistree</p>
          )}
        </div>
        <button
          onClick={handleRunMaintenance}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 text-xs font-medium transition-colors"
        >
          <Play className="h-3.5 w-3.5" />
          Relancer
        </button>
      </div>

      {/* ═══ Charts row ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 3. Uptime 7 days */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Uptime 7 jours (%)</h3>
          {uptimeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={uptimeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#64748b" }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} />
                <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                {SERVICES.map((s) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stackId="1"
                    stroke={CHART_COLORS[s.key]}
                    fill={CHART_COLORS[s.key]}
                    fillOpacity={0.15}
                    strokeWidth={1.5}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-600 py-10 text-center">Aucune donnee disponible</p>
          )}
        </div>

        {/* 4. Response time 30 days */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Temps de reponse moyen (ms) — 30j</h3>
          {rtChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={rtChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                {SERVICES.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    stroke={CHART_COLORS[s.key]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-slate-600 py-10 text-center">Aucune donnee disponible</p>
          )}
        </div>
      </div>

      {/* ═══ 14. Error rate bar chart ═══ */}
      {errorRateData.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Erreurs par Edge Function (24h)</h3>
          <ResponsiveContainer width="100%" height={Math.max(120, errorRateData.length * 32)}>
            <BarChart data={errorRateData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} width={110} />
              <ReTooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="errors24h" fill="#f87171" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ═══ 6. Edge Functions status ═══ */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Edge Functions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-slate-500 border-b border-white/5">
                <th className="text-left py-2 px-2 font-medium">Fonction</th>
                <th className="text-left py-2 px-2 font-medium">Dernier succes</th>
                <th className="text-right py-2 px-2 font-medium">Erreurs 24h</th>
              </tr>
            </thead>
            <tbody>
              {edgeFnStats.length > 0 ? (
                edgeFnStats.map((fn) => (
                  <tr key={fn.name} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-1.5 px-2 text-slate-300 font-mono">{fn.name}</td>
                    <td className="py-1.5 px-2 text-slate-500">{fn.lastSuccess ? formatRelative(fn.lastSuccess) : "—"}</td>
                    <td className="py-1.5 px-2 text-right">
                      {fn.errors24h > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">
                          {fn.errors24h}
                        </span>
                      ) : (
                        <span className="text-emerald-500">0</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-600">
                    Aucune donnee disponible
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 5. Incidents table ═══ */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-slate-200">Incidents recents</h3>
          <button
            onClick={handleExportHealthChecks}
            className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#0d1526]">
              <tr className="text-slate-500 border-b border-white/5">
                <th className="text-left py-2 px-2 font-medium">Date</th>
                <th className="text-left py-2 px-2 font-medium">Service</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
                <th className="text-right py-2 px-2 font-medium">Temps</th>
                <th className="text-left py-2 px-2 font-medium">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length > 0 ? (
                incidents.map((inc) => (
                  <tr key={inc.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-1.5 px-2 text-slate-400">{formatDate(inc.checked_at)}</td>
                    <td className="py-1.5 px-2 text-slate-300">{inc.service}</td>
                    <td className="py-1.5 px-2">
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          STATUS_COLORS[inc.status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"
                        }`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-500">{inc.response_time_ms ?? "—"}ms</td>
                    <td className="py-1.5 px-2 text-red-400/80 truncate max-w-[200px]">{inc.error_message ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-600">
                    <CheckCircle className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                    Aucun incident
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 12. Recent logins ═══ */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Connexions recentes</h3>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#0d1526]">
              <tr className="text-slate-500 border-b border-white/5">
                <th className="text-left py-2 px-2 font-medium">Date</th>
                <th className="text-left py-2 px-2 font-medium">Utilisateur</th>
                <th className="text-left py-2 px-2 font-medium">Methode</th>
                <th className="text-left py-2 px-2 font-medium">IP</th>
                <th className="text-left py-2 px-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.map((l) => (
                <tr
                  key={l.id}
                  className={`border-b border-white/[0.03] hover:bg-white/[0.02] ${
                    l.success === false ? "bg-red-500/[0.04]" : ""
                  }`}
                >
                  <td className="py-1.5 px-2 text-slate-400">{formatDate(l.created_at)}</td>
                  <td className="py-1.5 px-2 text-slate-300 truncate max-w-[160px]">{l.email ?? "—"}</td>
                  <td className="py-1.5 px-2 text-slate-500">{l.login_method ?? "—"}</td>
                  <td className="py-1.5 px-2 text-slate-500 font-mono">{l.ip_address ?? "—"}</td>
                  <td className="py-1.5 px-2">
                    {l.success === false ? (
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle className="h-3 w-3" />
                        Echec
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="h-3 w-3" />
                        OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {loginHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-600">Aucune connexion</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ 7. Global audit logs ═══ */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-200">Logs d'activite globaux</h3>
          {/* Filters */}
          <select
            value={logCabinetFilter}
            onChange={(e) => setLogCabinetFilter(e.target.value)}
            className="ml-auto text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-slate-300 outline-none"
          >
            <option value="">Tous les cabinets</option>
            {cabinetIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 8)}...
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filtrer action..."
            value={logActionFilter}
            onChange={(e) => setLogActionFilter(e.target.value)}
            className="text-[11px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-slate-300 outline-none w-32 placeholder:text-slate-600"
          />
          <button
            onClick={handleExportLogs}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#0d1526]">
              <tr className="text-slate-500 border-b border-white/5">
                <th className="text-left py-2 px-2 font-medium">Date</th>
                <th className="text-left py-2 px-2 font-medium">Cabinet</th>
                <th className="text-left py-2 px-2 font-medium">Utilisateur</th>
                <th className="text-left py-2 px-2 font-medium">Action</th>
                <th className="text-left py-2 px-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredAuditLogs.length > 0 ? (
                filteredAuditLogs.map((l) => (
                  <tr key={l.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-1.5 px-2 text-slate-400 whitespace-nowrap">{formatDate(l.created_at)}</td>
                    <td className="py-1.5 px-2 text-slate-500 font-mono truncate max-w-[80px]">
                      {l.cabinet_id ? l.cabinet_id.slice(0, 8) + "..." : "—"}
                    </td>
                    <td className="py-1.5 px-2 text-slate-300 truncate max-w-[140px]">{l.user_email ?? "—"}</td>
                    <td className="py-1.5 px-2">
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[10px]">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-slate-600 truncate max-w-[180px]">
                      {l.new_data ? JSON.stringify(l.new_data).slice(0, 60) : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-600">Aucun log</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
