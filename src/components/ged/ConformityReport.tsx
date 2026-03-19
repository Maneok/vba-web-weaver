import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { SirenFolder } from '@/services/gedService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ConformityReportProps {
  folders: SirenFolder[];
  cabinetName: string;
  generatedBy: string;
}

const REQUIRED_CATEGORIES = [
  'cni', 'kbis', 'rib', 'contrat', 'facture', 'attestation',
  'statuts', 'be', 'dbe',
];

const CATEGORY_LABELS: Record<string, string> = {
  cni: "Pièce d'identité (CNI/Passeport)",
  kbis: 'Extrait Kbis',
  rib: 'RIB',
  contrat: 'Contrat / Lettre de mission',
  facture: 'Justificatif de domicile',
  attestation: 'Attestation de vigilance',
  statuts: 'Statuts à jour',
  be: 'Registre des bénéficiaires effectifs',
  dbe: 'Déclaration des bénéficiaires effectifs',
};

function getFolderStatus(folder: SirenFolder): { label: string; symbol: string; order: number } {
  if (folder.has_expired) return { label: 'Non conforme', symbol: '\u274c', order: 0 };
  if (folder.completion_rate < 100) return { label: 'Incomplet', symbol: '\u26a0\ufe0f', order: 1 };
  return { label: 'Conforme', symbol: '\u2705', order: 2 };
}

function getMissingCategories(folder: SirenFolder): string[] {
  const present = new Set(folder.documents.map(d => d.category));
  return REQUIRED_CATEGORIES.filter(c => !present.has(c));
}

function getExpiredCount(folder: SirenFolder): number {
  const now = new Date();
  return folder.documents.filter(d => d.expiration_date && new Date(d.expiration_date) < now).length;
}

function buildReportHTML(folders: SirenFolder[], cabinetName: string, generatedBy: string): string {
  const now = format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  const sorted = [...folders].sort((a, b) => getFolderStatus(a).order - getFolderStatus(b).order);

  const complete = folders.filter(f => getFolderStatus(f).order === 2).length;
  const incomplete = folders.filter(f => getFolderStatus(f).order === 1).length;
  const nonConform = folders.filter(f => getFolderStatus(f).order === 0).length;
  const totalDocs = folders.reduce((s, f) => s + f.total_docs, 0);
  const totalExpired = folders.reduce((s, f) => s + getExpiredCount(f), 0);
  const avgCompletion = folders.length > 0
    ? Math.round(folders.reduce((s, f) => s + f.completion_rate, 0) / folders.length)
    : 0;

  // Non-conform folders with missing docs
  const nonConformDetails = sorted
    .filter(f => getFolderStatus(f).order < 2)
    .map(f => {
      const missing = getMissingCategories(f);
      if (missing.length === 0) return '';
      return `
        <tr>
          <td style="padding:6px 10px;border:1px solid #ddd;font-weight:600;">${f.client_name}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">${f.siren}</td>
          <td style="padding:6px 10px;border:1px solid #ddd;">
            <ul style="margin:0;padding-left:18px;">
              ${missing.map(c => `<li>${CATEGORY_LABELS[c] || c}</li>`).join('')}
            </ul>
          </td>
        </tr>`;
    })
    .filter(Boolean)
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Rapport de Conformité Documentaire LCB-FT</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size:13px; color:#1a1a1a; padding:40px; }
    h1 { font-size:22px; margin-bottom:4px; }
    h2 { font-size:16px; margin:28px 0 10px; border-bottom:2px solid #1a1a1a; padding-bottom:4px; }
    .header { text-align:center; margin-bottom:36px; }
    .header p { color:#555; font-size:13px; margin-top:4px; }
    .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:24px; }
    .kpi { border:1px solid #ddd; border-radius:6px; padding:12px; text-align:center; }
    .kpi .value { font-size:24px; font-weight:700; }
    .kpi .label { font-size:11px; color:#666; margin-top:2px; }
    table { border-collapse:collapse; width:100%; margin-bottom:20px; font-size:12px; }
    th { background:#f5f5f5; padding:8px 10px; border:1px solid #ddd; text-align:left; font-weight:600; }
    td { padding:6px 10px; border:1px solid #ddd; vertical-align:top; }
    .footer { margin-top:40px; text-align:center; font-size:11px; color:#999; border-top:1px solid #ddd; padding-top:12px; }
    @media print { body { padding:20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Rapport de Conformité Documentaire LCB-FT</h1>
    <p><strong>${cabinetName}</strong></p>
    <p>${now}</p>
    <p>Généré par ${generatedBy}</p>
  </div>

  <h2>Synthèse globale</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="value">${folders.length}</div><div class="label">Clients</div></div>
    <div class="kpi"><div class="value">${avgCompletion}%</div><div class="label">Complétude moyenne</div></div>
    <div class="kpi"><div class="value">${totalDocs}</div><div class="label">Documents</div></div>
    <div class="kpi"><div class="value" style="color:#22c55e">${complete}</div><div class="label">Conformes</div></div>
    <div class="kpi"><div class="value" style="color:#f59e0b">${incomplete}</div><div class="label">Incomplets</div></div>
    <div class="kpi"><div class="value" style="color:#ef4444">${nonConform}</div><div class="label">Non conformes</div></div>
  </div>

  <h2>Détail par client</h2>
  <table>
    <thead>
      <tr>
        <th>Client</th>
        <th>SIREN</th>
        <th>Docs fournis</th>
        <th>Docs manquants</th>
        <th>Docs expirés</th>
        <th>Statut</th>
      </tr>
    </thead>
    <tbody>
      ${sorted.map(f => {
        const status = getFolderStatus(f);
        const missing = getMissingCategories(f).length;
        const expired = getExpiredCount(f);
        return `<tr>
          <td>${f.client_name}</td>
          <td>${f.siren}</td>
          <td style="text-align:center">${f.total_docs}/${f.required_docs}</td>
          <td style="text-align:center">${missing}</td>
          <td style="text-align:center">${expired}</td>
          <td>${status.symbol} ${status.label}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  ${nonConformDetails ? `
  <h2>Documents manquants par client</h2>
  <table>
    <thead>
      <tr><th>Client</th><th>SIREN</th><th>Pièces manquantes</th></tr>
    </thead>
    <tbody>${nonConformDetails}</tbody>
  </table>
  ` : ''}

  <div class="footer">
    Document généré automatiquement par GRIMY — ${now} — Ne constitue pas un document officiel
  </div>
</body>
</html>`;
}

export default function ConformityReport({ folders, cabinetName, generatedBy }: ConformityReportProps) {
  const [generating, setGenerating] = useState(false);

  function generateReport() {
    setGenerating(true);
    try {
      const html = buildReportHTML(folders, cabinetName, generatedBy);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.print();
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={generateReport}
      disabled={generating || folders.length === 0}
    >
      {generating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 mr-2" />
      )}
      Rapport de conformité
    </Button>
  );
}
