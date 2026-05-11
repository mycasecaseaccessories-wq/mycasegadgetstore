// Phase 7 — Pagination helpers for Supabase queries.
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export const DEFAULT_PAGE_SIZE = 25;

export interface PageParams {
  page?: number;        // 0-indexed
  pageSize?: number;
}

export interface PageResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Apply 0-indexed pagination to a Supabase query builder. */
export function applyPagination<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  q: T,
  { page = 0, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): T {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  return q.range(from, to) as T;
}

/** Wrap a Supabase paginated result into a normalized shape. */
export function toPageResult<T>(
  data: T[] | null,
  count: number | null,
  { page = 0, pageSize = DEFAULT_PAGE_SIZE }: PageParams = {}
): PageResult<T> {
  const total = count ?? 0;
  return {
    rows: data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
