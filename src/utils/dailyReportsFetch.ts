import {
  DAILY_REPORTS_PAGE_SIZE,
  DAILY_REPORTS_RANGE_PAGE_SIZE,
  DAILY_REPORTS_MAX_LIMIT
} from '../config/apiLimits';

type RequestFn = (path: string, init?: Record<string, unknown>) => Promise<unknown>;

type DailyListResponse = {
  reports?: unknown[];
  pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
};

function asListResponse(data: unknown): DailyListResponse {
  return data && typeof data === 'object' ? (data as DailyListResponse) : {};
}

/**
 * All daily reports for one calendar day (UTC bucket, same as list filter), every page.
 */
export async function fetchAllDailyReportsForDate(
  request: RequestFn,
  dateYmd: string
): Promise<unknown[]> {
  const limit = Math.min(DAILY_REPORTS_PAGE_SIZE, DAILY_REPORTS_MAX_LIMIT);
  let page = 1;
  const all: unknown[] = [];
  let totalPages = 1;
  do {
    const q = new URLSearchParams({
      date: dateYmd,
      page: String(page),
      limit: String(limit)
    });
    const data = asListResponse(await request(`/api/reports/daily?${q.toString()}`));
    const batch = data.reports || [];
    all.push(...batch);
    totalPages = data.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}

/**
 * All daily reports in an inclusive UTC date range (matches PriceScreen filtering).
 */
export async function fetchAllDailyReportsInRange(
  request: RequestFn,
  startDate: string,
  endDate: string
): Promise<unknown[]> {
  const limit = Math.min(DAILY_REPORTS_RANGE_PAGE_SIZE, DAILY_REPORTS_MAX_LIMIT);
  let page = 1;
  const all: unknown[] = [];
  let totalPages = 1;
  do {
    const q = new URLSearchParams({
      startDate,
      endDate,
      page: String(page),
      limit: String(limit)
    });
    const data = asListResponse(await request(`/api/reports/daily?${q.toString()}`));
    const batch = data.reports || [];
    all.push(...batch);
    totalPages = data.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}
