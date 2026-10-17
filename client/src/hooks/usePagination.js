import { useCallback, useMemo, useState } from "react";

export const PAGE_SIZE_OPTIONS = [5, 10, 25];
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Pure pagination math — safe to unit-test without React.
 * Clamps page when the list shrinks; empty lists report totalPages = 1 and showPagination = false.
 */
export function computePagination(items, page, pageSize) {
  const list = Array.isArray(items) ? items : [];
  const size = Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE);
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size) || 1);
  const requested = Number(page);
  const safePage = Math.min(Math.max(1, Number.isFinite(requested) ? requested : 1), totalPages);
  const start = (safePage - 1) * size;
  const pageItems = list.slice(start, start + size);
  return {
    totalItems,
    totalPages,
    pageSize: size,
    page: safePage,
    pageItems,
    showPagination: totalItems > 0 && totalPages > 1,
  };
}

/**
 * Client-side pager for in-memory lists (default page size 10; options 5 / 10 / 25).
 */
export function usePagination(items, { initialPageSize = DEFAULT_PAGE_SIZE } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const result = useMemo(
    () => computePagination(items, page, pageSize),
    [items, page, pageSize]
  );

  const setPageSize = useCallback((next) => {
    setPageSizeState(Number(next) || DEFAULT_PAGE_SIZE);
    setPage(1);
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  return {
    ...result,
    setPage,
    setPageSize,
    resetPage,
  };
}
