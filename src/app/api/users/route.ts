import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, ADMIN_ROLES } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { UserRole } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser?.role || !ADMIN_ROLES.includes(currentUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, email, role } = await request.json() as { name: string; email: string; role: UserRole }
    if (!name || !email || !role) {
      return NextResponse.json({ error: 'name, email, and role are required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: 'ChangeMeNow1!',
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role,
        active: true,
        must_change_password: true,
      })
      .select()
      .single()

    if (insertError) {
      // Roll back auth user creation if DB insert fails
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active }, { status: 201 })
  } catch (err) {
    console.error('POST /api/users error:', err)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
