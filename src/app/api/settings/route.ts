import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, ADMIN_ROLES } from '@/lib/auth'
import { getSetting, setSetting } from '@/lib/db/settings'

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')
    if (!key) {
      return NextResponse.json({ error: 'key parameter is required' }, { status: 400 })
    }

    const value = await getSetting(key)
    return NextResponse.json({ key, value })
  } catch (err) {
    console.error('settings GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user?.role || !ADMIN_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { key, value } = await request.json() as { key: string; value: string }
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
    }

    await setSetting(key, value)
    return NextResponse.json({ key, value })
  } catch (err) {
    console.error('settings PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}
