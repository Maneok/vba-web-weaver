/**
 * Hook to load and cache scoring data from referential tables.
 * Provides scoringData for calculateRiskScore() and a refresh function
 * to invalidate cache after referential edits.
 *
 * Improvements:
 * #1  - Create useScoringData hook
 * #2  - Auto-load scoring data on mount
 * #3  - Provide refresh function for cache invalidation
 * #4  - Handle loading/error states
 * #5  - Re-fetch when cabinet changes
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { loadScoringData, clearScoringCache, type ScoringData } from "@/lib/riskEngine";
import { logger } from "@/lib/logger";

export function useScoringData() {
  const { profile } = useAuth();
  const [scoringData, setScoringData] = useState<ScoringData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (cabinetId: string) => {
    setLoading(true);
    try {
      const data = await loadScoringData(cabinetId);
      setScoringData(data);
    } catch (err) {
      logger.warn("useScoringData", "Failed to load scoring data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile?.cabinet_id) return;
    let cancelled = false;

    load(profile.cabinet_id).then(() => {
      if (cancelled) setScoringData(null);
    });

    return () => { cancelled = true; };
  }, [profile?.cabinet_id, load]);

  /** Invalidate cache and reload fresh scoring data from DB */
  const refresh = useCallback(() => {
    clearScoringCache();
    if (profile?.cabinet_id) {
      load(profile.cabinet_id);
    }
  }, [profile?.cabinet_id, load]);

  return { scoringData, loading, refresh };
}
