# Mobile Responsiveness — Tech-Facing Pages

**Date:** 2026-03-26
**Status:** Design approved, pending implementation

---

## Context

Technicians primarily use PM Scheduler on mobile devices. The parts entry form (just added) is unusable on phones — 5 fields crammed on one row. The dashboard and ticket detail pages also have mobile UX issues. This pass focuses on the three pages techs interact with: Dashboard, Tickets, and Ticket Detail.

---

## Changes

### 1. Parts Entry — Stacked Card Layout (P1)

**File:** `src/app/tickets/[id]/TicketActions.tsx`

Current: `flex items-start gap-2` with description, qty, price, remove all on one row.

Fix: Stack as a card on mobile, inline on desktop:
- Each part wrapped in a bordered card (`rounded-md border border-gray-200 p-3`) on mobile
- Row 1: full-width description/search input
- Row 2: qty + price + remove in a flex row
- Desktop (`sm:` breakpoint): revert to single-row layout
- Search dropdown: full-width, max-height with scroll

### 2. Dashboard Stat Cards (P2)

**File:** `src/app/page.tsx`

Current: `grid-cols-2 md:grid-cols-5` — cramped at 2-wide on small phones.

Fix: `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` — still 2-wide on phones but with better padding. Reduce text size on stat count from `text-2xl` to `text-xl` on mobile.

### 3. Ticket Detail Header (P3)

**File:** `src/app/tickets/[id]/page.tsx`

Fix:
- Back button: wrap in a 44px touch target (`p-2 -m-2 rounded-md`)
- Stack title + status badge on mobile: status badge moves below the title on small screens instead of `ml-auto`

### 4. Touch Targets (P3)

**Files:** `TicketActions.tsx`, `TicketBoard.tsx`

Increase button padding on mobile for Start Work, Mark Complete, Add Part, Apply filters. Pattern: `py-2.5 sm:py-2` or minimum `min-h-[44px]`.

---

## Files Modified

| File | Change |
|------|--------|
| `src/app/tickets/[id]/TicketActions.tsx` | Stack parts entry as cards on mobile |
| `src/app/page.tsx` | Responsive stat card grid + text sizing |
| `src/app/tickets/[id]/page.tsx` | Back button touch target, header stacking |
| `src/app/tickets/TicketBoard.tsx` | Touch target sizing on buttons |

---

## Verification

1. Open each page on a 375px viewport (iPhone SE size)
2. Parts entry: add a part, search, select — all fields accessible without horizontal scroll
3. Dashboard: stat cards readable, no text overflow
4. Ticket detail: back button easily tappable, header doesn't wrap awkwardly
5. All buttons at least 44px touch target
