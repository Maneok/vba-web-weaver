import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AuditRow {
  id: number;
  user_email: string;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  CONNEXION: "bg-[hsl(var(--status-valid))]/10 text-[hsl(var(--status-valid))]",
  DECONNEXION: "bg-muted text-muted-foreground",
  CREATION: "bg-primary/10 text-primary",
  MODIFICATION: "bg-[hsl(var(--risk-medium))]/10 text-[hsl(var(--risk-medium))]",
  SUPPRESSION: "bg-destructive/10 text-destructive",
  INVITATION_UTILISATEUR: "bg-[hsl(var(--chart-5))]/10 text-[hsl(var(--chart-5))]",
  CHANGEMENT_ROLE: "bg-[hsl(var(--risk-medium))]/10 text-[hsl(var(--risk-medium))]",
};

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("audit_trail")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);
        if (!mounted) return;
        if (error) {
          console.error("[AuditTrail] load error:", error);
          toast.error("Erreur lors du chargement du journal d'audit");
        } else if (data) {
          setEntries(data as AuditRow[]);
        }
      } catch (err) {
        if (mounted) {
          console.error("[AuditTrail] exception:", err);
          toast.error("Erreur lors du chargement du journal d'audit");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const filtered = entries.filter(
    (e) =>
      e.action.toLowerCase().includes(search.toLowerCase()) ||
      e.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      e.table_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" /> Piste d'Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Journal inalterable de toutes les actions - conforme aux exigences reglementaires
          </p>
        </div>
        <Card className="border-destructive/20">
          <CardContent className="p-3 flex items-center gap-2 text-xs text-destructive">
            <Shield className="w-4 h-4" />
            Tamper-proof : aucune modification/suppression possible
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par action, email, table..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Date/Heure</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>ID Enregistrement</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">{entry.id}</TableCell>
                  <TableCell className="text-xs font-mono">
                    {new Date(entry.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-xs">{entry.user_email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ACTION_COLORS[entry.action] || "bg-muted text-muted-foreground"}
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{entry.table_name || "-"}</TableCell>
                  <TableCell className="text-xs font-mono">{entry.record_id?.slice(0, 8) || "-"}</TableCell>
                  <TableCell className="text-xs max-w-[300px]">
                    <span className="block truncate cursor-help" title={entry.new_data ? JSON.stringify(entry.new_data) : ""}>
                      {entry.new_data ? JSON.stringify(entry.new_data).slice(0, 100) : "-"}
                      {entry.new_data && JSON.stringify(entry.new_data).length > 100 ? "..." : ""}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucune entree dans le journal d'audit
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
