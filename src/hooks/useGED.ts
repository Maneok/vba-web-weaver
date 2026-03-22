import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  fetchSirenFolders,
  fetchDocumentsByClientRef,
  getGEDStats,
  uploadDocument,
  deleteDocument,
  renameDocument,
  updateDocumentField,
  bulkUpdateCategory,
  renameAllToNorm,
  ocrClassifyDocument,
  type GEDDocument,
  type SirenFolder,
  type GEDStats,
} from '@/services/gedService';
import type { GEDDocument as ComponentGEDDocument } from '@/components/ged/types';
import { logAudit, fetchAuditLog, type AuditEntry } from '@/services/gedAuditService';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export function useGED(cabinetId: string, preselectedClientRef?: string) {
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

  // ── Pre-select folder from URL param ──────────────────────────
  useEffect(() => {
    if (preselectedClientRef && folders.length > 0 && selectedSiren !== preselectedClientRef) {
      const found = folders.find(f =>
        f.client_ref === preselectedClientRef || f.siren === preselectedClientRef
      );
      if (found) {
        setSelectedSiren(found.client_ref);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedClientRef, folders]);

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
        const folder = folders.find(f => f.client_ref === selectedSiren);
        const doc = await uploadDocument(
          file, selectedSiren, category, cabinetId,
          folder?.client_id,
          folder?.siren,
        );

        // ★ OCR auto-classification for images
        if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
          try {
            const ocrResult = await ocrClassifyDocument(doc.file_path);
            if (ocrResult && ocrResult.category !== 'autre' && ocrResult.category !== category) {
              await supabase.from('documents').update({
                category: ocrResult.category,
                label: ocrResult.name || null,
                description: JSON.stringify(ocrResult.ocrData),
              }).eq('id', doc.id);
              toast.info(`OCR : document reclassé en "${ocrResult.category}"`);
            } else if (ocrResult?.ocrData && Object.keys(ocrResult.ocrData).length > 0) {
              await supabase.from('documents').update({
                description: JSON.stringify(ocrResult.ocrData),
              }).eq('id', doc.id);
            }
          } catch (ocrErr) {
            logger.warn('GED', 'OCR auto-classification failed (non-bloquant)', ocrErr);
          }
        }

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
    [selectedSiren, cabinetId, folders, fireAudit],
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

  // ── #101 — Inline rename ───────────────────────────────────────
  const handleRename = useCallback(
    async (docId: string, newName: string) => {
      const doc = documents.find(d => d.id === docId);
      if (!doc) return;
      try {
        await renameDocument(docId, newName, doc.name);
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, name: newName } : d));
        fireAudit('rename', docId, { old_name: doc.name, new_name: newName });
        toast.success('Document renommé');
      } catch (err) {
        toast.error('Erreur lors du renommage');
      }
    },
    [documents, fireAudit],
  );

  // ── #102 — Inline category change ─────────────────────────────
  const handleCategoryChange = useCallback(
    async (docId: string, newCategory: string) => {
      try {
        await updateDocumentField(docId, 'category', newCategory);
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, category: newCategory } : d));
        fireAudit('category_change', docId, { new_category: newCategory });
        // Refresh folders to update KYC stats
        const updatedFolders = await fetchSirenFolders(cabinetId);
        setFolders(updatedFolders);
      } catch {
        toast.error('Erreur changement de catégorie');
      }
    },
    [cabinetId, fireAudit],
  );

  // ── #103 — Inline expiration change ───────────────────────────
  const handleExpirationChange = useCallback(
    async (docId: string, newDate: string | null) => {
      try {
        await updateDocumentField(docId, 'expiration_date', newDate);
        setDocuments(prev =>
          prev.map(d => d.id === docId ? { ...d, expiration_date: newDate } : d),
        );
        toast.success(newDate ? 'Date d\'expiration mise à jour' : 'Expiration supprimée');
      } catch {
        toast.error('Erreur mise à jour expiration');
      }
    },
    [],
  );

  // ── #109 — Inline label change ────────────────────────────────
  const handleLabelChange = useCallback(
    async (docId: string, newLabel: string) => {
      try {
        await updateDocumentField(docId, 'label', newLabel || null);
        setDocuments(prev =>
          prev.map(d => d.id === docId ? { ...d, label: newLabel || null } as GEDDocument : d),
        );
      } catch {
        toast.error('Erreur mise à jour du libellé');
      }
    },
    [],
  );

  // ── T10 — Unified field updater (for refactored DocumentRow) ──
  const handleUpdateField = useCallback(
    async (docId: string, field: string, value: unknown) => {
      // Delegate to specific handlers for fields that need extra logic
      if (field === 'name') {
        return handleRename(docId, value as string);
      }
      if (field === 'category') {
        return handleCategoryChange(docId, value as string);
      }
      if (field === 'expiration') {
        return handleExpirationChange(docId, value as string | null);
      }
      if (field === 'label') {
        return handleLabelChange(docId, value as string);
      }
      // Generic field update for description, notes, tags, etc.
      try {
        // Map component field names to DB column names
        const dbField = field === 'expiration' ? 'expiration_date' : field;
        await updateDocumentField(docId, dbField, value);
        setDocuments(prev =>
          prev.map(d => d.id === docId ? { ...d, [dbField]: value } as GEDDocument : d),
        );
      } catch {
        toast.error('Erreur mise à jour');
      }
    },
    [handleRename, handleCategoryChange, handleExpirationChange, handleLabelChange],
  );

  // ── #106 — Bulk category change ───────────────────────────────
  const handleBulkCategoryChange = useCallback(
    async (docIds: string[], newCategory: string) => {
      try {
        await bulkUpdateCategory(docIds, newCategory);
        setDocuments(prev =>
          prev.map(d => docIds.includes(d.id) ? { ...d, category: newCategory } : d),
        );
        fireAudit('category_change', null, { doc_count: docIds.length, new_category: newCategory });
        toast.success(`${docIds.length} document(s) mis à jour`);
        const updatedFolders = await fetchSirenFolders(cabinetId);
        setFolders(updatedFolders);
      } catch {
        toast.error('Erreur mise à jour en masse');
      }
    },
    [cabinetId, fireAudit],
  );

  // ── #104 — Rename all to norm ─────────────────────────────────
  const handleRenameAllToNorm = useCallback(
    async () => {
      if (!selectedSiren || !cabinetId) return;
      const folder = folders.find(f => f.client_ref === selectedSiren);
      if (!folder) return;
      try {
        const count = await renameAllToNorm(selectedSiren, cabinetId, folder.siren);
        if (count > 0) {
          const docs = await fetchDocumentsByClientRef(selectedSiren, cabinetId);
          setDocuments(docs);
          fireAudit('rename', null, { action: 'normalize_all', count });
          toast.success(`${count} document(s) renommé(s)`);
        } else {
          toast.info('Tous les documents sont déjà normalisés');
        }
      } catch {
        toast.error('Erreur lors du renommage');
      }
    },
    [selectedSiren, cabinetId, folders, fireAudit],
  );

  // ── #116 — Favorites ─────────────────────────────────────────
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('ged-favorites') || '[]');
    } catch { return []; }
  });

  const toggleFavorite = useCallback((clientRef: string) => {
    setFavorites(prev => {
      const next = prev.includes(clientRef)
        ? prev.filter(r => r !== clientRef)
        : [...prev, clientRef];
      localStorage.setItem('ged-favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── #118 — "Récents" filter ───────────────────────────────────
  const filteredFoldersWithFavs = useMemo(() => {
    let result = filteredFolders;

    // #118 — Recent filter: docs added within 7 days
    if (statusFilter === 'recent' as any) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      result = result.filter(f => f.last_update && new Date(f.last_update) >= sevenDaysAgo);
    }

    // #116 — Sort favorites first
    if (favorites.length > 0) {
      result = [...result].sort((a, b) => {
        const aFav = favorites.includes(a.client_ref) ? 0 : 1;
        const bFav = favorites.includes(b.client_ref) ? 0 : 1;
        return aFav - bFav;
      });
    }

    return result;
  }, [filteredFolders, favorites, statusFilter]);

  // ── #141 — Date upload filter ─────────────────────────────────
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month' | 'old'>('all');

  const filteredDocumentsWithDate = useMemo(() => {
    let result = filteredDocuments;
    const now = new Date();

    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
      result = result.filter(d => new Date(d.created_at) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
      result = result.filter(d => new Date(d.created_at) >= monthAgo);
    } else if (dateFilter === 'old') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      result = result.filter(d => new Date(d.created_at) < yearStart);
    }

    return result;
  }, [filteredDocuments, dateFilter]);

  return {
    // Data
    folders,
    filteredFolders: filteredFoldersWithFavs,
    selectedSiren,
    documents,
    filteredDocuments: filteredDocumentsWithDate,
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
    dateFilter,
    setDateFilter,

    // Actions
    handleSelectSiren,
    handleUpload,
    handleDelete,
    refreshFolders,

    // Inline editing (#101-#109)
    handleRename,
    handleCategoryChange,
    handleExpirationChange,
    handleLabelChange,
    handleUpdateField,
    handleBulkCategoryChange,
    handleRenameAllToNorm,

    // Favorites (#116)
    favorites,
    toggleFavorite,

    // Audit
    auditEntries,
    auditLoading,
    refreshAuditLog,
    fireAudit,
  };
}
