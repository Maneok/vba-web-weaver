// ============================================
// Classification automatique par nom de fichier
// ============================================

const CLASSIFICATION_RULES: { pattern: RegExp; category: string }[] = [
  { pattern: /extrait.*kbis|extrait.*k-bis/i, category: 'extrait_kbis' },
  { pattern: /kbis|k-bis|extrait.*rcs|immatriculation/i, category: 'kbis' },
  { pattern: /cni|carte.*identit[ée]|passeport|passport|id.*card/i, category: 'cni_dirigeant' },
  { pattern: /rib|relev[ée].*identit[ée].*bancaire|iban|bic/i, category: 'rib' },
  { pattern: /justificatif.*domicile|facture.*(?:edf|engie|eau|gaz|electri)|taxe.*habitation|avis.*imposition/i, category: 'justificatif_domicile' },
  { pattern: /statut|status|constitution/i, category: 'statuts' },
  { pattern: /b[ée]n[ée]ficiaire.*effectif|beneficial.*owner|dbe|registre.*be/i, category: 'liste_beneficiaires_effectifs' },
  { pattern: /attestation.*vigilance|urssaf|attestation.*fiscal/i, category: 'attestation_vigilance' },
  { pattern: /source.*fonds|origin.*fonds|provenance/i, category: 'declaration_source_fonds' },
  { pattern: /patrimoine|heritage|wealth/i, category: 'justificatif_patrimoine' },
  { pattern: /contrat|convention|accord|lettre.*mission/i, category: 'contrat' },
  { pattern: /pv|proc[èe]s.*verbal|assembl[ée]e/i, category: 'pv_assemblee' },
  { pattern: /bilan|compte.*r[ée]sultat|liasse.*fiscal/i, category: 'bilan' },
];

export function classifyDocument(filename: string): { category: string; confidence: 'high' | 'medium' | 'low' } {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');

  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(nameWithoutExt)) {
      return { category: rule.category, confidence: 'high' };
    }
  }

  // Tentative sur le nom brut (moins fiable)
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.pattern.test(filename)) {
      return { category: rule.category, confidence: 'medium' };
    }
  }

  return { category: 'autre', confidence: 'low' };
}

// ============================================
// Expiration automatique par catégorie
// ============================================

const EXPIRATION_DEFAULTS: Record<string, number> = {
  kbis: 90,                           // 3 mois
  extrait_kbis: 90,                   // 3 mois
  cni_dirigeant: 3650,                // 10 ans
  justificatif_domicile: 90,          // 3 mois
  rib: 365,                           // 1 an
  statuts: 0,                         // pas d'expiration
  attestation_vigilance: 180,         // 6 mois
  liste_beneficiaires_effectifs: 365, // 1 an
  declaration_source_fonds: 365,      // 1 an
  justificatif_patrimoine: 365,       // 1 an
  contrat: 0,
  pv_assemblee: 0,
  bilan: 0,
};

export function getDefaultExpiration(category: string): Date | null {
  const days = EXPIRATION_DEFAULTS[category];
  if (!days || days === 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function getExpirationLabel(category: string): string {
  const days = EXPIRATION_DEFAULTS[category];
  if (!days || days === 0) return "Pas d'expiration";
  if (days < 365) return `${Math.round(days / 30)} mois`;
  return `${Math.round(days / 365)} an(s)`;
}

// ============================================
// Détection de doublons
// ============================================

export interface DuplicateCheck {
  isDuplicate: boolean;
  existingDoc?: { id: string; name: string; created_at: string; version: number };
}

export function checkDuplicate(
  filename: string,
  fileSize: number,
  existingDocs: { id: string; name: string; size: number; created_at: string; version: number }[],
): DuplicateCheck {
  // Même nom exact
  const exactMatch = existingDocs.find((d) => d.name === filename);
  if (exactMatch) {
    return { isDuplicate: true, existingDoc: exactMatch };
  }

  // Même nom sans extension + même taille (probable doublon renommé)
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const sizeMatch = existingDocs.find((d) => {
    const dNameClean = d.name.replace(/\.[^.]+$/, '').toLowerCase();
    return dNameClean === nameWithoutExt && d.size === fileSize;
  });
  if (sizeMatch) {
    return { isDuplicate: true, existingDoc: sizeMatch };
  }

  return { isDuplicate: false };
}

// ============================================
// Renommage normalisé
// ============================================

const CATEGORY_LABELS_SHORT: Record<string, string> = {
  kbis: 'KBIS',
  extrait_kbis: 'EXTRAIT_KBIS',
  cni_dirigeant: 'CNI',
  justificatif_domicile: 'JUSTIF_DOMICILE',
  rib: 'RIB',
  statuts: 'STATUTS',
  attestation_vigilance: 'ATTESTATION',
  liste_beneficiaires_effectifs: 'BE',
  declaration_source_fonds: 'SOURCE_FONDS',
  justificatif_patrimoine: 'PATRIMOINE',
  contrat: 'CONTRAT',
  pv_assemblee: 'PV',
  bilan: 'BILAN',
  autre: 'DOC',
};

export function generateNormalizedName(
  siren: string,
  category: string,
  version: number,
  originalExtension: string,
): string {
  const label = CATEGORY_LABELS_SHORT[category] || 'DOC';
  const date = new Date().toISOString().split('T')[0];
  const ext = originalExtension.startsWith('.') ? originalExtension : `.${originalExtension}`;
  return `${siren}_${label}_${date}_v${version}${ext}`;
}

// ============================================
// Catégories KYC disponibles
// ============================================

export const GED_CATEGORIES = [
  { value: 'kbis', label: 'KBis' },
  { value: 'extrait_kbis', label: 'Extrait KBis' },
  { value: 'cni_dirigeant', label: 'CNI Dirigeant' },
  { value: 'justificatif_domicile', label: 'Justificatif domicile' },
  { value: 'rib', label: 'RIB' },
  { value: 'statuts', label: 'Statuts' },
  { value: 'attestation_vigilance', label: 'Attestation vigilance' },
  { value: 'liste_beneficiaires_effectifs', label: 'Bénéficiaires effectifs' },
  { value: 'declaration_source_fonds', label: 'Source des fonds' },
  { value: 'justificatif_patrimoine', label: 'Justificatif patrimoine' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'pv_assemblee', label: 'PV Assemblée' },
  { value: 'bilan', label: 'Bilan' },
  { value: 'autre', label: 'Autre' },
] as const;

// ============================================
// Formatage taille fichier
// ============================================

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ============================================
// Compression image côté client
// ============================================

export async function compressImage(file: File, maxSizeMB: number = 2): Promise<File> {
  if (file.size <= maxSizeMB * 1024 * 1024) return file;
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxDim = 2000;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width *= ratio;
        height *= ratio;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.8,
      );
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });
}
