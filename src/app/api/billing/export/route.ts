import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUser } from '@/lib/db/users'
import { MANAGER_ROLES } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    if (!monthParam || !yearParam) {
      return NextResponse.json(
        { error: 'month and year query parameters are required' },
        { status: 400 }
      )
    }

    const month = parseInt(monthParam, 10)
    const year = parseInt(yearParam, 10)

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month or year' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify auth and role — billing data is manager/coordinator only
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const dbUser = await getUser(user.id)
    if (!dbUser || !MANAGER_ROLES.includes(dbUser.role!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('pm_tickets')
      .select(`
        *,
        customers(name, account_number),
        equipment(make, model, serial_number),
        users!assigned_technician_id(name)
      `)
      .eq('status', 'completed')
      .eq('billing_exported', false)
      .eq('month', month)
      .eq('year', year)
      .order('customer_id')

    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    console.error('billing/export error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch billing export data' },
      { status: 500 }
    )
  }
}
