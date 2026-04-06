import { createClient } from '@/lib/supabase/server'
import { CustomerRow, ContactRow, ShipToLocationRow } from '@/types/database'

export async function getCustomers(search?: string): Promise<CustomerRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*')
    .eq('active', true)
    .order('name')
    .limit(50)

  if (search) {
    query = query.or(`name.ilike.%${search}%,account_number.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) throw error
  return data
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