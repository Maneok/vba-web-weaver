import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  fetchSirenFolders,
  fetchDocumentsByClientRef,
  getGEDStats,
  uploadDocument,
  deleteDocument,
  type GEDDocument,
  type SirenFolder,
  type GEDStats,
} from '@/services/gedService';
import { logAudit, fetchAuditLog, type AuditEntry } from '@/services/gedAuditService';
import { supabase } from '@/integrations/supabase/client';

export function useGED(cabinetId: string) {
  // ── Core state ──────────────────────────────────────────────────
  const [folders, setFolders] = useState<SirenFolder[]>([]);
  const [selectedSiren, setSelectedSiren] = useState<string | null>(null);
  const [documents, setDocuments] = useState<GEDDocument[]>([]);
  const [stats, setStats] = useState<GEDStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Filtres ─────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'incomplete' | 'alert'>('all');

  // ── Audit ─────────────────────────────────────────────────────
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // ── Load folders ────────────────────────────────────────────────
  const refreshFolders = useCallback(async () => {
    if (!cabinetId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSirenFolders(cabinetId);
      setFolders(data);
      setStats(getGEDStats(data));

      // Auto-select first folder if none selected
      if (data.length > 0 && !selectedSiren) {
        setSelectedSiren(data[0].client_ref);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur chargement des dossiers';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [cabinetId, selectedSiren]);

  useEffect(() => {
    refreshFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabinetId]);

  // ── Load documents when selectedSiren changes ──────────────────
  useEffect(() => {
    if (!selectedSiren || !cabinetId) {
      setDocuments([]);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const docs = await fetchDocumentsByClientRef(selectedSiren, cabinetId);
        if (!cancelled) setDocuments(docs);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Erreur chargement documents';
          toast.error(msg);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedSiren, cabinetId]);

  // ── Recalculate stats when folders change ──────────────────────
  useEffect(() => {
    setStats(getGEDStats(folders));
  }, [folders]);

  // ── Filtered folders ───────────────────────────────────────────
  const filteredFolders = useMemo(() => {
    let result = folders;

    // Search filter (client name or siren)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        f =>
          f.client_name.toLowerCase().includes(q) ||
          f.siren.toLowerCase().includes(q) ||
          f.client_ref.toLowerCase().includes(q),
      );
    }

    // Status filter
    if (statusFilter === 'complete') {
      result = result.filter(f => f.completion_rate >= 100);
    } else if (statusFilter === 'incomplete') {
      result = result.filter(f => f.completion_rate < 100 && !f.has_expired);
    } else if (statusFilter === 'alert') {
      result = result.filter(f => f.has_expired);
    }

    return result;
  }, [folders, searchQuery, statusFilter]);

  // ── Filtered & sorted documents ────────────────────────────────
  const filteredDocuments = useMemo(() => {
    let result = documents;

    // Category filter
    if (activeCategory !== 'Tous') {
      result = result.filter(d => d.category === activeCategory);
    }

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortColumn];
      const bVal = (b as Record<string, unknown>)[sortColumn];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return result;
  }, [documents, activeCategory, sortColumn, sortDirection]);

  // ── Audit helper ───────────────────────────────────────────────
  const fireAudit = useCallback(
    (action: string, documentId: string | null, details?: Record<string, unknown>) => {
      if (!cabinetId || !selectedSiren) return;
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        logAudit({
          documentId,
          cabinetId,
          siren: selectedSiren,
          action,
          actorId: user.id,
          actorName: user.email || 'Utilisateur',
          details,
        }).catch(() => {});
      });
    },
    [cabinetId, selectedSiren],
  );

  const refreshAuditLog = useCallback(async () => {
    if (!cabinetId || !selectedSiren) {
      setAuditEntries([]);
      return;
    }
    setAuditLoading(true);
    try {
      const folder = folders.find(f => f.client_ref === selectedSiren);
      const entries = await fetchAuditLog({
        siren: folder?.siren || selectedSiren,
        cabinetId,
        limit: 50,
      });
      setAuditEntries(entries);
    } catch {
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  }, [cabinetId, selectedSiren, folders]);

  // Load audit log when siren changes
  useEffect(() => {
    refreshAuditLog();
  }, [selectedSiren, refreshAuditLog]);

  // ── Actions ─────────────────────────────────────────────────────

  const handleSelectSiren = useCallback((clientRef: string) => {
    setSelectedSiren(clientRef);
  }, []);

  const handleUpload = useCallback(
    async (file: File, category: string) => {
      if (!selectedSiren || !cabinetId) {
        toast.error('Sélectionnez un dossier client');
        return;
      }

      setUploading(true);
      try {
        const doc = await uploadDocument(file, selectedSiren, category, cabinetId);
        toast.success(`"${file.name}" importé avec succès`);
        fireAudit('upload', doc.id, { document_name: file.name, category });
        // Refresh the current folder's documents + global folders
        const docs = await fetchDocumentsByClientRef(selectedSiren, cabinetId);
        setDocuments(docs);
        const updatedFolders = await fetchSirenFolders(cabinetId);
        setFolders(updatedFolders);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur lors de l'import";
        toast.error(msg);
      } finally {
        setUploading(false);
      }
    },
    [selectedSiren, cabinetId, fireAudit],
  );

  const handleDelete = useCallback(
    async (docId: string) => {
      try {
        const doc = documents.find(d => d.id === docId);
        await deleteDocument(docId);
        toast.success('Document supprimé');
        fireAudit('delete', docId, { document_name: doc?.name });
        // Refresh
        setDocuments(prev => prev.filter(d => d.id !== docId));
        const updatedFolders = await fetchSirenFolders(cabinetId);
        setFolders(updatedFolders);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
        toast.error(msg);
      }
    },
    [cabinetId, documents, fireAudit],
  );

  return {
    // Data
    folders,
    filteredFolders,
    selectedSiren,
    documents,
    filteredDocuments,
    stats,
    loading,
    uploading,
    error,

    // Filters
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    statusFilter,
    setStatusFilter,

    // Actions
    handleSelectSiren,
    handleUpload,
    handleDelete,
    refreshFolders,

    // Audit
    auditEntries,
    auditLoading,
    refreshAuditLog,
    fireAudit,
  };
}
