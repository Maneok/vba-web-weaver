import { useMemo, useState, useCallback } from "react";

interface UsePaginationOptions {
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

interface UsePaginationResult<T> {
  page: number;
  pageSize: number;
  totalPages: number;
  paginated: T[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goFirst: () => void;
  goLast: () => void;
  goNext: () => void;
  goPrev: () => void;
  pageSizeOptions: number[];
  pageInfo: string;
}

export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {},
): UsePaginationResult<T> {
  const { defaultPageSize = 25, pageSizeOptions = [10, 25, 50, 100] } = options;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Clamp page to valid range when items or pageSize change
  const safePage = Math.min(page, totalPages - 1);

  const paginated = useMemo(
    () => items.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [items, safePage, pageSize],
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPage(0);
  }, []);

  const goFirst = useCallback(() => setPage(0), []);
  const goLast = useCallback(() => setPage(totalPages - 1), [totalPages]);
  const goNext = useCallback(() => setPage(p => Math.min(p + 1, totalPages - 1)), [totalPages]);
  const goPrev = useCallback(() => setPage(p => Math.max(p - 1, 0)), []);

  const start = safePage * pageSize + 1;
  const end = Math.min((safePage + 1) * pageSize, items.length);
  const pageInfo = items.length > 0
    ? `${start}-${end} sur ${items.length}`
    : "Aucun resultat";

  return {
    page: safePage,
    pageSize,
    totalPages,
    paginated,
    setPage,
    setPageSize,
    goFirst,
    goLast,
    goNext,
    goPrev,
    pageSizeOptions,
    pageInfo,
  };
}
