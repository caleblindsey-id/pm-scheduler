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

    // Listing endpoint — narrow to the columns the UI actually renders.
    // `select('*')` previously leaked customer_signature (base64 blobs),
    // photos JSONB, parts arrays, completion notes, and billing contact
    // fields to every coordinator who hit this endpoint.
    //
    // Filter by completed_date range to match the billing page's
    // getBillingTickets — previously this filtered by month/year columns,
    // which can drift from completed_date when the cross-month-completion
    // slide hits a unique-constraint conflict.
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    const { data, error } = await supabase
      .from('pm_tickets')
      .select(`
        id, work_order_number, completed_date, hours_worked, billing_amount,
        billing_exported, status, po_number, month, year,
        customers(name, account_number, ar_terms, po_required),
        equipment(make, model),
        users!assigned_technician_id(name)
      `)
      .eq('status', 'completed')
      .eq('billing_exported', false)
      .gte('completed_date', startDate)
      .lt('completed_date', endDate)
      .is('deleted_at', null)
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
