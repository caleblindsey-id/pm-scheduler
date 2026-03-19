#!/usr/bin/env python3
"""
PM Scheduler — Nightly Synergy Sync
Reads customers, contacts, and products from SynergyERP MySQL
and upserts them to Supabase via REST API.

Runs nightly at 5:00 AM via Windows Task Scheduler.
"""

import os
import sys
import json
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

BATCH_SIZE = 500  # Max records per Supabase upsert request

# ============================================================
# Logging setup
# ============================================================

def setup_logging() -> logging.Logger:
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    logs_dir = project_root / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    log_filename = logs_dir / f"sync-{datetime.now().strftime('%Y-%m-%d')}.log"
    log_format = "%(asctime)s [%(levelname)s] %(message)s"

    logger = logging.getLogger("synergy_sync")
    logger.setLevel(logging.DEBUG)

    # File handler — DEBUG and above
    fh = logging.FileHandler(log_filename, encoding="utf-8")
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(logging.Formatter(log_format))

    # Console handler — INFO and above
    ch = logging.StreamHandler(sys.stdout)
    ch.setLevel(logging.INFO)
    ch.setFormatter(logging.Formatter(log_format))

    logger.addHandler(fh)
    logger.addHandler(ch)

    return logger


log = setup_logging()


# ============================================================
# Helpers
# ============================================================

def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def build_address(addr1, addr2, city, state, zip_code) -> str | None:
    parts = []
    if addr1 and str(addr1).strip():
        parts.append(str(addr1).strip())
    if addr2 and str(addr2).strip():
        parts.append(str(addr2).strip())
    city_state_zip = " ".join(
        p for p in [
            str(city).strip() if city else "",
            str(state).strip() if state else "",
            str(zip_code).strip() if zip_code else "",
        ]
        if p
    )
    if city_state_zip:
        parts.append(city_state_zip)
    return ", ".join(parts) if parts else None


def safe_str(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


# ============================================================
# Supabase REST helpers
# ============================================================

def supabase_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }


def supabase_upsert(table: str, records: list[dict], on_conflict: str | None = "synergy_id") -> int:
    """POST a batch of records to Supabase with upsert semantics. Returns count upserted."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    response = requests.post(url, json=records, headers=supabase_headers(), timeout=60)
    if not response.ok:
        raise RuntimeError(
            f"Supabase upsert to '{table}' failed [{response.status_code}]: {response.text[:500]}"
        )
    return len(records)


def upsert_in_batches(records: list[dict], table: str, on_conflict: str | None = "synergy_id") -> int:
    """Upsert records in batches of BATCH_SIZE. Returns total count upserted."""
    if not records:
        log.info(f"  No records to upsert for table '{table}'.")
        return 0

    total = 0
    for i in range(0, len(records), BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        count = supabase_upsert(table, batch, on_conflict=on_conflict)
        total += count
        log.debug(f"  Upserted batch {i // BATCH_SIZE + 1} ({len(batch)} records) to '{table}'.")

    return total


def supabase_post(table: str, record: dict) -> dict:
    """POST a single record (no upsert). Used for sync_log inserts."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    response = requests.post(url, json=record, headers=headers, timeout=30)
    if not response.ok:
        raise RuntimeError(
            f"Supabase POST to '{table}' failed [{response.status_code}]: {response.text[:500]}"
        )
    data = response.json()
    return data[0] if isinstance(data, list) and data else {}


def supabase_patch(table: str, row_id: int, record: dict) -> None:
    """PATCH a row by integer id. Used to update the sync_log entry on completion."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{row_id}"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    response = requests.patch(url, json=record, headers=headers, timeout=30)
    if not response.ok:
        raise RuntimeError(
            f"Supabase PATCH to '{table}' id={row_id} failed [{response.status_code}]: {response.text[:500]}"
        )


# ============================================================
# Sync log helpers
# ============================================================

def write_sync_log_start(sync_type: str, started_at: str) -> int | None:
    """Insert a 'running' sync_log row. Returns the new row id."""
    try:
        row = supabase_post("sync_log", {
            "sync_type": sync_type,
            "started_at": started_at,
            "status": "running",
            "records_synced": 0,
            "completed_at": None,
            "error_message": None,
        })
        return row.get("id")
    except Exception as e:
        log.warning(f"Could not write sync_log start entry: {e}")
        return None


def write_sync_log_complete(
    row_id: int | None,
    completed_at: str,
    records_synced: int,
    status: str,
    error_message: str | None = None,
) -> None:
    if row_id is None:
        return
    try:
        supabase_patch("sync_log", row_id, {
            "completed_at": completed_at,
            "records_synced": records_synced,
            "status": status,
            "error_message": error_message,
        })
    except Exception as e:
        log.warning(f"Could not update sync_log row {row_id}: {e}")


# ============================================================
# ERP table discovery
# ============================================================

def discover_tables(conn) -> set[str]:
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES")
    tables = {row[0].lower() for row in cursor.fetchall()}
    log.info(f"Discovered ERP tables: {sorted(tables)}")
    return tables


# ============================================================
# Sync: Customers
# ============================================================

def sync_customers(conn) -> int:
    log.info("--- Syncing customers ---")
    cursor = conn.cursor()

    # Synergy cust table uses CustomerCode (int) as the customer number.
    # SCStatus: 0 = normal, 1 = credit hold. No Active column — sync all.
    cursor.execute("""
        SELECT CustomerCode, Name, Terms, SCStatus,
               Addr1, Addr2, City, State, Zip4
        FROM cust
        ORDER BY CustomerCode
    """)

    rows = cursor.fetchall()
    log.info(f"  Fetched {len(rows)} customer rows from Synergy.")

    customers = []
    for row in rows:
        billing_address = build_address(
            row.Addr1, row.Addr2, row.City, row.State, row.Zip4
        )
        customers.append({
            "synergy_id": str(row.CustomerCode).strip(),
            "name": str(row.Name).strip(),
            "account_number": str(row.CustomerCode).strip(),
            "ar_terms": str(row.Terms) if row.Terms is not None else None,
            "credit_hold": row.SCStatus == 1,
            "billing_address": billing_address,
            "synced_at": utcnow_iso(),
        })

    count = upsert_in_batches(customers, "customers")
    log.info(f"  Customers synced: {count}")
    return count


# ============================================================
# Sync: Products
# ============================================================

def sync_products(conn) -> int:
    log.info("--- Syncing products ---")
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT ProdCode, Desc1, ListPrice1
            FROM prod
            ORDER BY ProdCode
        """)
    except Exception as e:
        log.warning(f"  Could not query 'prod' table: {e}. Skipping products sync.")
        return 0

    rows = cursor.fetchall()
    log.info(f"  Fetched {len(rows)} product rows from Synergy.")

    products = []
    for row in rows:
        products.append({
            "synergy_id": str(row.ProdCode).strip(),
            "number": str(row.ProdCode).strip(),
            "description": safe_str(row.Desc1),
            "unit_price": float(row.ListPrice1) if row.ListPrice1 is not None else None,
            "synced_at": utcnow_iso(),
        })

    count = upsert_in_batches(products, "products")
    log.info(f"  Products synced: {count}")
    return count


# ============================================================
# Sync: Contacts
# ============================================================

def sync_contacts(conn, known_tables: set[str]) -> int:
    log.info("--- Syncing contacts ---")

    # Synergy stores contacts in 'contlist': CustCode (int), Contact (int id),
    # FirstName, LastName, Email, Phone (int).
    if "contlist" not in known_tables:
        log.info("  'contlist' table not found. Skipping contacts sync.")
        return 0

    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT CustCode, Contact, FirstName, LastName, Email, Phone
            FROM contlist
            ORDER BY CustCode, Contact
        """)
        rows = cursor.fetchall()
    except Exception as e:
        log.warning(f"  Failed to query 'contlist': {e}. Skipping contacts sync.")
        return 0

    log.info(f"  Fetched {len(rows)} contact rows from Synergy.")

    cust_map = fetch_customer_synergy_id_map()

    contacts = []
    skipped = 0
    for row in rows:
        customer_id = cust_map.get(str(row.CustCode)) if row.CustCode is not None else None
        if customer_id is None:
            skipped += 1
            continue

        # Build full name from first + last
        first = safe_str(row.FirstName)
        last = safe_str(row.LastName)
        name = " ".join(p for p in [first, last] if p) or None

        # Phone stored as int — convert to string, skip zeros
        phone_raw = row.Phone
        phone = str(phone_raw).strip() if phone_raw and int(phone_raw) != 0 else None

        # synergy_id is composite (CustCode-Contact) because Contact is per-customer sequence
        synergy_id = f"{row.CustCode}-{row.Contact}" if row.Contact is not None else None

        contacts.append({
            "customer_id": customer_id,
            "synergy_id": synergy_id,
            "name": name,
            "email": safe_str(row.Email),
            "phone": phone,
            "is_primary": False,
        })

    if skipped:
        log.debug(f"  Skipped {skipped} contacts with no matching customer in Supabase.")

    # Deduplicate on synergy_id (some ERP rows have duplicate CustCode+Contact)
    seen: set[str] = set()
    insertable = []
    for c in contacts:
        sid = c.get("synergy_id")
        if sid and sid not in seen:
            seen.add(sid)
            insertable.append(c)

    # contacts.synergy_id has a unique index but not a named constraint,
    # so PostgREST on_conflict doesn't work. Truncate and re-insert each sync.
    if insertable:
        try:
            del_url = f"{SUPABASE_URL}/rest/v1/contacts?id=gte.0"
            del_headers = {
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Prefer": "return=minimal",
            }
            requests.delete(del_url, headers=del_headers, timeout=30)
            log.debug("  Cleared existing contacts before re-insert.")
        except Exception as e:
            log.warning(f"  Could not clear contacts: {e}")

    count = upsert_in_batches(insertable, "contacts", on_conflict=None)
    log.info(f"  Contacts synced: {count}")
    return count


def fetch_customer_synergy_id_map() -> dict[str, int]:
    """Fetch all customers from Supabase and return a dict of synergy_id -> id."""
    url = f"{SUPABASE_URL}/rest/v1/customers?select=id,synergy_id&limit=50000"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        return {row["synergy_id"]: row["id"] for row in data if row.get("synergy_id")}
    except Exception as e:
        log.warning(f"Could not fetch customer map from Supabase: {e}")
        return {}


# ============================================================
# Validation
# ============================================================

def validate_env() -> None:
    errors = []
    if not SUPABASE_URL:
        errors.append("SUPABASE_URL is not set.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        errors.append("SUPABASE_SERVICE_ROLE_KEY is not set.")
    if errors:
        for e in errors:
            log.error(e)
        sys.exit(1)


# ============================================================
# Main
# ============================================================

def main() -> None:
    log.info("=" * 60)
    log.info("PM Scheduler — Nightly Synergy Sync starting")
    log.info("=" * 60)

    validate_env()

    started_at = utcnow_iso()
    sync_log_id = write_sync_log_start("full", started_at)
    log.debug(f"sync_log row created: id={sync_log_id}")

    erp_conn = None
    total_synced = 0
    failures: list[str] = []

    try:
        log.info("Connecting to SynergyERP via ODBC DSN 'ERPlinked'...")
        erp_conn = pyodbc.connect("DSN=ERPlinked", autocommit=True)
        log.info("Connected.")

        known_tables = discover_tables(erp_conn)

        # --- Customers ---
        try:
            count = sync_customers(erp_conn)
            total_synced += count
        except Exception as e:
            log.error(f"Customer sync failed: {e}", exc_info=True)
            failures.append(f"customers: {e}")

        # --- Contacts ---
        try:
            count = sync_contacts(erp_conn, known_tables)
            total_synced += count
        except Exception as e:
            log.error(f"Contact sync failed: {e}", exc_info=True)
            failures.append(f"contacts: {e}")

        # --- Products ---
        try:
            count = sync_products(erp_conn)
            total_synced += count
        except Exception as e:
            log.error(f"Product sync failed: {e}", exc_info=True)
            failures.append(f"products: {e}")

    except pyodbc.Error as e:
        log.error(f"Could not connect to SynergyERP: {e}", exc_info=True)
        failures.append(f"odbc_connection: {e}")

    finally:
        if erp_conn:
            erp_conn.close()
            log.debug("ERP connection closed.")

    completed_at = utcnow_iso()

    if failures:
        error_summary = "; ".join(failures)
        log.error(f"Sync completed with failures: {error_summary}")
        log.info(f"Total records synced before failure(s): {total_synced}")
        write_sync_log_complete(
            sync_log_id,
            completed_at,
            total_synced,
            status="failed",
            error_message=error_summary,
        )
        sys.exit(1)
    else:
        log.info(f"Sync completed successfully. Total records synced: {total_synced}")
        write_sync_log_complete(
            sync_log_id,
            completed_at,
            total_synced,
            status="success",
        )
        sys.exit(0)


if __name__ == "__main__":
    main()
