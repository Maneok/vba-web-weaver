import { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Client, AlerteRegistre, Collaborateur } from "@/lib/types";
import type { CockpitUrgency } from "@/lib/cockpitEngine";

interface DashboardExportProps {
  clients: Client[];
  alertes: AlerteRegistre[];
  collaborateurs: Collaborateur[];
  stats: {
    totalClients: number;
    avgScore: number;
    tauxConformite: number;
    alertesEnCours: number;
    revuesEchues: number;
    caPrevisionnel: number;
  };
  cockpitUrgencies?: CockpitUrgency[];
  complianceItems?: { label: string; value: number; target?: number; description?: string }[];
}

function escapeCSV(val: unknown): string {
  const str = String(val ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename: string, content: string) {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDate(): string {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardExport({
  clients,
  alertes,
  collaborateurs,
  stats,
  cockpitUrgencies = [],
  complianceItems = [],
}: DashboardExportProps) {
  const [exporting, setExporting] = useState(false);

  function exportSynthese() {
    setExporting(true);
    try {
      const rows = [
        ["Indicateur", "Valeur"],
        ["Clients actifs", stats.totalClients],
        ["Score moyen", stats.avgScore],
        ["Taux de conformité", `${stats.tauxConformite}%`],
        ["Alertes en cours", stats.alertesEnCours],
        ["Revues échues", stats.revuesEchues],
        ["CA prévisionnel", `${stats.caPrevisionnel}€`],
        ["Collaborateurs", collaborateurs.length],
        ["Date export", formatDate()],
      ];
      const csv = rows.map((r) => r.map(escapeCSV).join(",")).join("\n");
      downloadCSV(`synthese-dashboard-${formatDate()}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }

  function exportClients() {
    setExporting(true);
    try {
      const headers = ["Référence", "Raison sociale", "SIREN", "Vigilance", "Score", "Statut", "Date butoir"];
      const rows = clients.map((c) => [
        c.ref,
        c.raisonSociale,
        c.siren || "",
        c.nivVigilance || "",
        c.scoreGlobal ?? "",
        c.statut || c.etat || "",
        c.dateButoir || "",
      ]);
      const csv = [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
      downloadCSV(`clients-${formatDate()}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }

  function exportAlertes() {
    setExporting(true);
    try {
      const headers = ["Date", "Client", "Catégorie", "Détails", "Statut"];
      const rows = alertes.map((a) => [
        a.date,
        a.clientConcerne,
        a.categorie,
        a.details,
        a.statut || "",
      ]);
      const csv = [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
      downloadCSV(`alertes-${formatDate()}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }

  function exportCockpit() {
    setExporting(true);
    try {
      const headers = ["Sévérité", "Type", "Titre", "Détail", "Référence client"];
      const rows = cockpitUrgencies.map((u) => [
        u.severity,
        u.type,
        u.title,
        u.detail,
        u.ref || "",
      ]);
      const csv = [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
      downloadCSV(`anomalies-cockpit-${formatDate()}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }

  function exportCompliance() {
    setExporting(true);
    try {
      const headers = ["Indicateur", "Valeur (%)", "Objectif (%)", "Atteint", "Description"];
      const rows = complianceItems.map((item) => [
        item.label,
        item.value,
        item.target ?? "",
        item.target != null ? (item.value >= item.target ? "Oui" : "Non") : "",
        item.description || "",
      ]);
      const csv = [headers, ...rows].map((r) => r.map(escapeCSV).join(",")).join("\n");
      downloadCSV(`conformite-${formatDate()}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0"
          disabled={exporting}
          title="Exporter les données"
          aria-label="Exporter les données du tableau de bord"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={exportSynthese} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" />
          Synthèse du dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportClients} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" />
          Liste des clients
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAlertes} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" />
          Alertes en cours
        </DropdownMenuItem>
        {cockpitUrgencies.length > 0 && (
          <DropdownMenuItem onClick={exportCockpit} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" />
            Anomalies cockpit
          </DropdownMenuItem>
        )}
        {complianceItems.length > 0 && (
          <DropdownMenuItem onClick={exportCompliance} className="gap-2 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4" />
            Rapport de conformité
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
