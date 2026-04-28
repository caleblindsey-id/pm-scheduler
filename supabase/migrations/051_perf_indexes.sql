-- Migration 051: Performance indexes for hot dashboard / list-page paths.
--
-- Audit context: the dashboard, /tickets list, and /service pages each fan
-- out several count + list queries that were hitting seq scans because the
-- existing single-column indexes (003_indexes.sql) didn't cover the actual
-- predicates being pushed down. Three composite/partial indexes here:
--
-- 1. Overdue PM lookup. `getTickets({ overdueOnly })` and `getOverdueTicketCount`
--    in src/lib/db/tickets.ts filter by status IN (overdue-eligible) AND
--    (year < Y OR (year = Y AND month < M)) AND deleted_at IS NULL. The .or()
--    rewrites to a UNION the planner can satisfy with this composite if the
--    partial predicate matches.
--
-- 2. Prior-open-PM lookup used by /api/tickets/generate to flag duplicates.
--    Filters by equipment_id IN (...) AND status IN (open) AND deleted_at IS NULL.
--    The 043 partial index is on (month, year) which doesn't help equipment lookups.
--
-- 3. Service-ticket dashboard counts. getServiceTicketCounts and the per-status
--    fan-out filter on (status [, assigned_technician_id]). Single-column status
--    index exists; the composite covers the tech-scoped variant.

CREATE INDEX IF NOT EXISTS idx_pm_tickets_year_month_status_live
  ON pm_tickets (year, month, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_tickets_equipment_status_live
  ON pm_tickets (equipment_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_service_tickets_status_tech
  ON service_tickets (status, assigned_technician_id);
