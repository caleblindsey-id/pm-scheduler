import { createClient } from '@/lib/supabase/server'
import { CustomerRow, ContactRow, ShipToLocationRow } from '@/types/database'

// List columns the customers list page actually renders. The detail page uses
// the wider `getCustomer` helper below for the full row.
const LIST_COLUMNS = 'id, name, account_number, ar_terms, credit_hold, active, billing_city, billing_state, po_required, show_pricing_on_pm_pdf'

export async function getCustomers(search?: string): Promise<CustomerRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select(LIST_COLUMNS)
    .eq('active', true)
    .order('name')
    .limit(50)

  if (search) {
    // Strip PostgREST filter-syntax chars before injecting into .or().
    const safe = search.replace(/[,()]/g, ' ')
    query = query.or(`name.ilike.%${safe}%,account_number.ilike.%${safe}%`)
  }

  const { data, error } = await query

  if (error) throw error
  return data as unknown as CustomerRow[]
}

export async function getCustomer(
  id: number
): Promise<(CustomerRow & { contacts: ContactRow[]; ship_to_locations: ShipToLocationRow[] }) | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customers')
    .select('*, contacts(*), ship_to_locations(*)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data as unknown as CustomerRow & { contacts: ContactRow[]; ship_to_locations: ShipToLocationRow[] }
}