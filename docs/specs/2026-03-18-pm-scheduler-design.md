# PM Scheduler — Design Specification

**Version:** 1.0
**Date:** 2026-03-18
**Author:** Caleb Lindsey
**Status:** Phase 1 — Foundation

---

## 1. Project Context

### What This Is

PM Scheduler is a preventive maintenance (PM) tracking and billing tool built for a commercial cleaning equipment service operation. It replaces **EasyBee**, the current system used to manage PM work orders, scheduling, and technician assignments.

### Why We're Building It

EasyBee is a third-party SaaS tool with limitations in workflow customization, reporting, and integration with the core ERP (Synergy). The replacement system will:

- Be purpose-built for this operation's PM workflow
- Integrate directly with Synergy customer, contact, and product data via a nightly sync
- Provide a clean web interface for managers, coordinators, and technicians
- Automate monthly PM batch generation
- Produce billing-ready exports that can be entered into Synergy

### Relationship to Synergy

PM Scheduler is a **satellite of Synergy**, not a replacement. Synergy remains the system of record for:
- Customer master data
- Contacts
- Product catalog and pricing
- Invoicing and AR

PM Scheduler reads Synergy data (via nightly sync) and writes PM-specific data (equipment records, schedules, tickets). Billing exports from PM Scheduler are entered manually into Synergy to create invoices.

### EasyBee Migration Note

When migrating from EasyBee, the following data needs to be imported:
- Active equipment records (make, model, serial number, customer linkage)
- Active PM schedules (frequency, billing type, flat rate)
- Open PM tickets (if any are in-flight at cutover)
- Historical PM ticket data (optional — can be archived separately)

A migration script or manual import process should be scoped before go-live.

---

## 2. Architecture

### Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Web UI — server and client components |
| Styling | Tailwind CSS | Utility-first CSS |
| Icons | Lucide React | Icon library |
| Backend | Next.js API Routes | Server-side logic, Supabase interaction |
| Database | Supabase (PostgreSQL) | Hosted Postgres with auth, RLS, and REST API |
| Auth | Supabase Auth | Email/password login with role-based access |
| Hosting | Vercel | Serverless deployment for Next.js |
| Sync Script | Python 3.9+ | Nightly data pull from Synergy ERP via ODBC |

### Architecture Diagram

```
[Synergy ERP / MySQL]
        |
        | ODBC (ERPlinked DSN)
        |
[Python Sync Script] ──────► [Supabase REST API]
  (runs nightly on                   |
   workstation)                      |
                              [PostgreSQL DB]
                                     |
                              [Next.js App]
                                     |
                              [Vercel CDN]
                                     |
                         [Browser — Manager/Coordinator/Tech]
```

### Key Design Decisions

1. **Supabase over self-hosted Postgres** — Managed auth, RLS, and REST API out of the box. No server to maintain.
2. **Next.js App Router** — Server components for data fetching, client components only where interactivity is needed.
3. **Nightly sync instead of live integration** — Synergy's MySQL 5.5 backend doesn't support webhooks. A nightly pull is sufficient for customer/product data that changes infrequently.
4. **Billing export (not direct invoice creation)** — Invoicing remains in Synergy. PM Scheduler produces an export file; a coordinator enters it in Synergy. This avoids needing write access to the ERP.

---

## 3. Database Schema

### Overview

8 tables total. 3 are synced from Synergy (read-only in the app). 5 are owned by PM Scheduler.

### Synced from Synergy (read-only)

#### `customers`
Synergy customer master. Synced nightly.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | Internal ID |
| synergy_id | VARCHAR UNIQUE | Synergy customer ID (used for upsert) |
| name | VARCHAR | Customer name |
| account_number | VARCHAR | Synergy account number |
| ar_terms | VARCHAR | e.g., "Net 30" |
| credit_hold | BOOLEAN | True if customer is on credit hold |
| billing_address | TEXT | Full billing address block |
| synced_at | TIMESTAMPTZ | Last sync timestamp |

#### `contacts`
Customer contacts from Synergy.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| customer_id | INT FK → customers | |
| synergy_id | VARCHAR | Synergy contact ID |
| name | VARCHAR | |
| email | VARCHAR | |
| phone | VARCHAR | |
| is_primary | BOOLEAN | Primary billing contact |

#### `products`
Synergy product catalog — parts and labor items used in PMs.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| synergy_id | VARCHAR UNIQUE | |
| number | VARCHAR | Synergy part number |
| description | VARCHAR | |
| unit_price | DECIMAL(10,2) | Current price from Synergy |
| synced_at | TIMESTAMPTZ | |

### Owned by PM Scheduler

#### `users`
App users with roles. Must also have a Supabase Auth account (same UUID).

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | Must match Supabase Auth UID |
| email | VARCHAR UNIQUE | |
| name | VARCHAR | |
| role | TEXT | manager / coordinator / technician |
| active | BOOLEAN | Inactive users cannot log in |
| created_at | TIMESTAMPTZ | |

#### `equipment`
Individual pieces of equipment under a PM agreement.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| customer_id | INT FK → customers | |
| default_technician_id | UUID FK → users | Default tech for PM tickets |
| make | VARCHAR | e.g., "Tennant" |
| model | VARCHAR | e.g., "T7" |
| serial_number | VARCHAR | |
| description | TEXT | Additional notes |
| location_on_site | VARCHAR | Where the machine lives at the customer site |
| active | BOOLEAN | Inactive = not included in PM batch generation |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `pm_schedules`
PM schedule definition for a piece of equipment. One equipment record can have one schedule.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| equipment_id | UUID FK → equipment | |
| frequency | TEXT | monthly / quarterly / semi-annual / annual |
| billing_type | TEXT | flat_rate / time_and_materials / contract |
| flat_rate | DECIMAL(10,2) | Used when billing_type = flat_rate |
| active | BOOLEAN | Inactive schedules are skipped in batch generation |
| created_at | TIMESTAMPTZ | |

#### `pm_tickets`
Individual PM work orders. Generated in monthly batches; completed by technicians.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| pm_schedule_id | UUID FK → pm_schedules | |
| equipment_id | UUID FK → equipment | |
| customer_id | INT FK → customers | Denormalized for query convenience |
| assigned_technician_id | UUID FK → users | |
| created_by_id | UUID FK → users | Who ran the batch generation |
| month | INT | 1–12 |
| year | INT | |
| status | TEXT | unassigned / assigned / in_progress / completed / billed |
| scheduled_date | DATE | Target completion date |
| completed_date | DATE | Actual completion date |
| completion_notes | TEXT | Tech notes |
| hours_worked | DECIMAL(5,2) | For T&M billing |
| parts_used | JSONB | Array of {product_id, quantity, unit_price} |
| billing_amount | DECIMAL(10,2) | Calculated or flat rate |
| billing_exported | BOOLEAN | True after included in a billing export |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `sync_log`
Audit trail for nightly sync runs.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| sync_type | VARCHAR | customers / contacts / products / full |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| records_synced | INT | |
| status | TEXT | running / success / failed |
| error_message | TEXT | Populated on failure |

---

## 4. User Roles and Permissions

### Roles

| Role | Description |
|---|---|
| manager | Full access. Can manage users, equipment, schedules, and tickets. Can run billing exports. |
| coordinator | Can manage equipment, schedules, and tickets. Cannot manage users or access billing export. |
| technician | Read-only access to equipment and schedules. Can view and update their own assigned tickets. |

### Permission Matrix

| Action | Manager | Coordinator | Technician |
|---|---|---|---|
| View customers / contacts / products | Yes | Yes | Yes |
| Manage users | Yes | No | No |
| Manage equipment | Yes | Yes | No |
| Manage PM schedules | Yes | Yes | No |
| Generate monthly PM batch | Yes | Yes | No |
| View all tickets | Yes | Yes | No |
| View own tickets | Yes | Yes | Yes |
| Update own ticket (complete, add notes) | Yes | Yes | Yes |
| Run billing export | Yes | No | No |
| View sync log | Yes | Yes | No |

---

## 5. Application Pages

### Public / Auth

| Page | Route | Description |
|---|---|---|
| Login | `/login` | Email/password login via Supabase Auth |

### Dashboard

| Page | Route | Description |
|---|---|---|
| Dashboard | `/` | Summary cards: open tickets, overdue tickets, tickets by status this month |

### Equipment

| Page | Route | Description |
|---|---|---|
| Equipment List | `/equipment` | All active equipment with customer name, make/model, schedule frequency |
| Equipment Detail | `/equipment/[id]` | Full equipment record + linked schedule + ticket history |
| New Equipment | `/equipment/new` | Form to add a new piece of equipment |
| Edit Equipment | `/equipment/[id]/edit` | Edit equipment record |

### PM Schedules

| Page | Route | Description |
|---|---|---|
| Schedules List | `/schedules` | All active PM schedules with equipment and billing type |
| New Schedule | `/schedules/new` | Attach a PM schedule to a piece of equipment |
| Edit Schedule | `/schedules/[id]/edit` | Edit schedule frequency and billing type |

### Tickets

| Page | Route | Description |
|---|---|---|
| Ticket Board | `/tickets` | Kanban or list view of tickets by status. Filterable by month, technician, customer. |
| Ticket Detail | `/tickets/[id]` | Full ticket view. Technicians can mark complete, add notes, log hours, add parts. |
| Generate Batch | `/tickets/generate` | Manager/coordinator: select month/year and generate PM batch |

### Customers

| Page | Route | Description |
|---|---|---|
| Customer List | `/customers` | Read-only view of synced Synergy customers |
| Customer Detail | `/customers/[id]` | Customer info + linked equipment + open tickets |

### Billing

| Page | Route | Description |
|---|---|---|
| Billing Export | `/billing` | Manager only. Select month, review completed tickets, export to CSV or PDF for Synergy entry. |

### Admin

| Page | Route | Description |
|---|---|---|
| User Management | `/admin/users` | Manager only. Add, edit, deactivate users. |
| Sync Status | `/admin/sync` | View sync_log. See last sync time and status. |

---

## 6. Key Workflows

### 6.1 Monthly PM Batch Generation

**Trigger:** Manual — coordinator or manager navigates to `/tickets/generate` and selects a month and year.

**Logic:**
1. Query all active `pm_schedules`.
2. For each schedule, determine whether a ticket should be generated for the selected month based on `frequency`:
   - monthly: always generate
   - quarterly: generate in months 1, 4, 7, 10
   - semi-annual: generate in months 1, 7
   - annual: generate in month 1
3. Check whether a ticket already exists for that `pm_schedule_id` + `month` + `year` combination. Skip if it does (idempotent).
4. Create `pm_tickets` records with `status = 'unassigned'`, pre-populated with `equipment_id`, `customer_id`, and `assigned_technician_id` from the equipment's `default_technician_id`.
5. Return a summary: X tickets generated, Y skipped (already existed).

**Notes:**
- Batch generation is idempotent — running it twice does not create duplicates.
- Quarterly/semi-annual/annual months are hardcoded. Future enhancement: allow custom month selection per schedule.

### 6.2 Completing a PM

**Actor:** Technician (or coordinator/manager on behalf of tech)

**Steps:**
1. Tech logs in and views `/tickets` — sees only their assigned tickets.
2. Tech opens a ticket and sets status to `in_progress`.
3. After completing the PM on-site, tech opens the ticket and:
   - Sets `completed_date`
   - Enters `completion_notes`
   - Enters `hours_worked` (for T&M billing)
   - Adds any parts used (select from product list, enter quantity)
4. Tech sets status to `completed`.
5. System calculates `billing_amount`:
   - flat_rate: uses `pm_schedules.flat_rate`
   - time_and_materials: `hours_worked * labor_rate + sum(parts_used)`
   - contract: $0 (billed separately via contract)

### 6.3 Billing Export

**Actor:** Manager only

**Steps:**
1. Manager navigates to `/billing`.
2. Selects a month and year.
3. System displays all `completed` tickets where `billing_exported = false` for that period.
4. Manager reviews the list, can edit `billing_amount` if needed.
5. Manager clicks "Export" — system:
   - Generates a CSV (and/or PDF) with columns: Customer, Equipment, PM Date, Description, Amount
   - Marks all included tickets as `billing_exported = true`
   - Updates ticket status to `billed`
6. Manager takes the export to Synergy and manually creates invoices.

### 6.4 Nightly Sync

See Section 7 for full design.

**Summary:** A Python script runs nightly on the workstation where Synergy is accessible. It connects to MySQL via the `ERPlinked` ODBC DSN, pulls updated customers, contacts, and products, and upserts them into Supabase via the REST API.

---

## 7. Nightly Sync Design

### Purpose

Keep PM Scheduler's customer, contact, and product data in sync with Synergy without requiring a live database connection from the web app.

### Architecture

```
[Synergy MySQL 5.5]
       |
       | pyodbc + ERPlinked DSN
       |
[synergy-sync.py] — runs nightly via Windows Task Scheduler
       |
       | HTTPS (Supabase REST API)
       |
[Supabase — customers, contacts, products tables]
```

### Script: `scripts/sync/synergy-sync.py`

**Location:** Runs on the workstation where Synergy's MySQL is accessible (same workstation that runs Compass).

**Schedule:** Windows Task Scheduler — 2:00 AM nightly.

**Environment variables required:**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (bypasses RLS for sync writes)

**Steps:**
1. Insert a `sync_log` record with `status = 'running'`.
2. Connect to MySQL via `pyodbc.connect("DSN=ERPlinked")`.
3. Pull customers: `SELECT custno, name, terms, credhold, address FROM cust WHERE active = 1`
4. Upsert into Supabase `customers` table on `synergy_id` conflict.
5. Pull contacts: linked to active customers.
6. Upsert into Supabase `contacts` table.
7. Pull products: active products with current pricing.
8. Upsert into Supabase `products` table.
9. Update `sync_log` record with `status = 'success'` and `records_synced` count.
10. On any error: update `sync_log` with `status = 'failed'` and `error_message`.

### Conflict Resolution

- **Customers/Products:** Upsert on `synergy_id`. If the record exists, update all fields and set `synced_at = now()`.
- **Contacts:** Delete and re-insert per customer (simpler than tracking individual contact changes).
- **Deleted records:** Customers removed from Synergy are NOT deleted from PM Scheduler. They are left in place so historical PM data is preserved. A future enhancement could add a `synergy_active` flag.

### Sync Frequency Rationale

Nightly is sufficient because:
- Customer data (name, address, terms) changes rarely
- New customers added in Synergy show up in PM Scheduler by the next morning
- Product pricing changes are non-urgent for PM scheduling purposes

### Error Handling

- If sync fails, the `sync_log` record captures the error.
- The app's Sync Status page (`/admin/sync`) surfaces failures so coordinators can spot them.
- The script sends an email alert on failure (future enhancement).

---

## 8. EasyBee Migration Reference

When cutting over from EasyBee:

1. **Export from EasyBee:** Pull all active equipment, schedules, and open tickets.
2. **Map to schema:** Equipment fields map directly. Schedules need frequency and billing type verified.
3. **Customer matching:** Match EasyBee customers to Synergy `synergy_id` values. This is the most manual step.
4. **Import order:** customers → equipment → pm_schedules → pm_tickets (open only).
5. **Historical data:** Keep EasyBee accessible in read-only mode for 90 days post-cutover for reference.
6. **Cutover timing:** Recommend cutting over at the start of a month, after the prior month's billing export is complete and entered in Synergy.

---

## 9. Open Questions

- [ ] What is the labor rate for T&M billing? Is it per technician or flat?
- [ ] Should the billing export format be CSV, PDF, or both?
- [ ] Do quarterly/semi-annual PMs always start in January, or can they be offset?
- [ ] Should technicians be able to see customer contact info in the ticket view?
- [ ] What is the target go-live date?

---

*This spec is a living document. Update it as decisions are made.*
