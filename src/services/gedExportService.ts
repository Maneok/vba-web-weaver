import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { logger } from '@/lib/logger';
import type { GEDDocument } from '@/services/gedService';

export async function exportSirenDossier(
  siren: string,
  clientName: string,
  documents: GEDDocument[],
  getSignedUrlFn: (path: string) => Promise<string>,
): Promise<void> {
  const zip = new JSZip();

  for (const doc of documents) {
    try {
      const url = await getSignedUrlFn(doc.file_path);
      const response = await fetch(url);
      const blob = await response.blob();
      zip.file(`${doc.category}/${doc.name}`, blob);
    } catch (err) {
      logger.error('GED Export', `Erreur export ${doc.name}`, err);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const safeName = clientName.replace(/[^a-zA-Z0-9À-ÿ_-]/g, '_');
  const date = new Date().toISOString().split('T')[0];
  const zipName = `DOSSIER_KYC_${siren}_${safeName}_${date}.zip`;
  saveAs(content, zipName);
}
