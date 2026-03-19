export interface GEDDocument {
  id: string;
  name: string;
  category: string;
  size: number;
  version: number;
  expiration: string | null;
  url: string;
  created_at: string;
  siren: string;
  uploaded_by?: string;
}

export interface SirenFolder {
  siren: string;
  clientName: string;
  documents: GEDDocument[];
  requiredDocs: number;
  lastUpdate: string;
  hasExpiredDoc: boolean;
}
