import type { SearchFilters, SessionRegistryEntry } from "../types";

// ─── Structured Filter (Layer 1) ───────────────────────────────────
// Filters sessions by structured metadata: user, project, branch, date, status.
// Instant, zero cost.

export function applyStructuredFilter(
  sessions: Record<string, SessionRegistryEntry>,
  filters: SearchFilters
): Map<string, SessionRegistryEntry> {
  const results = new Map<string, SessionRegistryEntry>();

  for (const [id, entry] of Object.entries(sessions)) {
    if (matchesFilters(entry, filters)) {
      results.set(id, entry);
    }
  }

  return results;
}

function matchesFilters(entry: SessionRegistryEntry, filters: SearchFilters): boolean {
  if (filters.user) {
    if (!entry.identity.user.toLowerCase().includes(filters.user.toLowerCase())) {
      return false;
    }
  }

  if (filters.project) {
    if (!entry.project.toLowerCase().includes(filters.project.toLowerCase())) {
      return false;
    }
  }

  if (filters.branch) {
    if (!entry.branch.toLowerCase().includes(filters.branch.toLowerCase())) {
      return false;
    }
  }

  if (filters.status) {
    if (entry.status !== filters.status) {
      return false;
    }
  }

  if (filters.dateFrom) {
    if (entry.startedAt < filters.dateFrom) {
      return false;
    }
  }

  if (filters.dateTo) {
    if (entry.startedAt > filters.dateTo) {
      return false;
    }
  }

  if (filters.files && filters.files.length > 0) {
    const hasFile = filters.files.some((f) =>
      entry.files.some((ef) => ef.includes(f))
    );
    if (!hasFile) {
      return false;
    }
  }

  return true;
}
