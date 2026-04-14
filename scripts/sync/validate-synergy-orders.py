#!/usr/bin/env python3
"""
PM Scheduler — Nightly Synergy Order Validation
Checks service_tickets.synergy_order_number against roh.OrdNum in Synergy.
Flags mismatches as 'invalid' so office staff can correct them.

Runs nightly at 5:30 AM via Windows Task Scheduler (after the 5 AM sync).
"""

import os
import sys
import logging
import pyodbc
import requests
from datetime import datetime, timezone
from pathlib import Path

# ============================================================
# Configuration
# ============================================================

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ============================================================
# Logging setup
# ============================================================

def setup_logging() -> logging.Logger:
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    logs_dir = project_root / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    log_filename = logs_dir / f"validation-{datetime.now().strftime('%Y-%m-%d')}.log"
    log_format = "%(asctime)s [%(levelname)s] %(message)s"

    logger = logging.getLogger("synergy_validation")
    logger.setLevel(logging.DEBUG)

    fh = logging.FileHandler(log_filename, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter(log_format))
    logger.addHandler(fh)

    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter(log_format))
    logger.addHandler(ch)

    return logger


log = setup_logging()

# ============================================================
# Supabase helpers
# ============================================================

def supabase_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def supabase_get(table: str, params: dict) -> list[dict]:
    """GET rows from Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = supabase_headers()
    headers["Prefer"] = "return=representation"
    response = requests.get(url, params=params, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


def supabase_patch_by_id(table: str, row_id: str, data: dict) -> None:
    """PATCH a row by UUID id."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{row_id}"
    headers = supabase_headers()
    headers["Prefer"] = "return=minimal"
    response = requests.patch(url, json=data, headers=headers, timeout=15)
    response.raise_for_status()

# ============================================================
# Main validation logic
# ============================================================

def main():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        log.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
        sys.exit(1)

    log.info("=" * 60)
    log.info("Synergy Order Validation — starting")
    log.info("=" * 60)

    # 1. Fetch service tickets with order numbers
    log.info("Fetching service tickets with Synergy order numbers...")
    tickets = supabase_get("service_tickets", {
        "select": "id,synergy_order_number",
        "synergy_order_number": "not.is.null",
        "status": "not.in.(canceled,declined)",
    })

    if not tickets:
        log.info("No service tickets with order numbers found. Nothing to validate.")
        return

    log.info(f"Found {len(tickets)} tickets with order numbers.")

    # 2. Collect unique order numbers
    order_map: dict[int, list[str]] = {}  # OrdNum -> list of ticket IDs
    skipped = 0
    for t in tickets:
        raw = str(t["synergy_order_number"]).strip()
        try:
            ord_num = int(raw)
            order_map.setdefault(ord_num, []).append(t["id"])
        except ValueError:
            # Non-numeric order numbers are automatically invalid
            log.warning(f"  Ticket {t['id']}: non-numeric order number '{raw}' — marking invalid")
            skipped += 1
            supabase_patch_by_id("service_tickets", t["id"], {
                "synergy_validation_status": "invalid",
                "synergy_validated_at": datetime.now(timezone.utc).isoformat(),
            })

    unique_orders = list(order_map.keys())
    log.info(f"Unique order numbers to validate: {len(unique_orders)} ({skipped} skipped as non-numeric)")

    if not unique_orders:
        log.info("No numeric order numbers to validate.")
        return

    # 3. Query Synergy for matching OrdNums
    log.info("Connecting to Synergy ERP (DSN=ERPlinked)...")
    try:
        conn = pyodbc.connect("DSN=ERPlinked", autocommit=True, timeout=30)
        cursor = conn.cursor()
    except Exception as e:
        log.error(f"Failed to connect to Synergy: {e}")
        sys.exit(1)

    # Batch the IN clause if there are many order numbers
    valid_orders: set[int] = set()
    batch_size = 100
    for i in range(0, len(unique_orders), batch_size):
        batch = unique_orders[i:i + batch_size]
        placeholders = ",".join(str(o) for o in batch)
        sql = f"SELECT OrdNum FROM roh WHERE OrdNum IN ({placeholders})"
        cursor.execute(sql)
        for row in cursor.fetchall():
            valid_orders.add(row[0])

    conn.close()
    log.info(f"Synergy returned {len(valid_orders)} matching orders out of {len(unique_orders)} checked.")

    # 4. Update validation status on each ticket
    now_iso = datetime.now(timezone.utc).isoformat()
    valid_count = 0
    invalid_count = 0

    for ord_num, ticket_ids in order_map.items():
        status = "valid" if ord_num in valid_orders else "invalid"
        for tid in ticket_ids:
            supabase_patch_by_id("service_tickets", tid, {
                "synergy_validation_status": status,
                "synergy_validated_at": now_iso,
            })
            if status == "valid":
                valid_count += 1
            else:
                invalid_count += 1
                log.warning(f"  INVALID: Ticket {tid} — order #{ord_num} not found in Synergy")

    # 5. Summary
    log.info("-" * 40)
    log.info(f"Validation complete:")
    log.info(f"  Valid:   {valid_count}")
    log.info(f"  Invalid: {invalid_count}")
    log.info(f"  Skipped: {skipped}")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
