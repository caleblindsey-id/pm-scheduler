import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pages technicians are allowed to access
const TECH_ALLOWED_PAGES = ['/', '/tickets', '/login', '/change-password']
const TECH_ALLOWED_PAGE_PATTERNS = [
  /^\/tickets\/[^/]+$/,    // /tickets/[id]
  /^\/equipment\/[^/]+$/,  // /equipment/[id] — read-only for techs
]

// API routes technicians are allowed to access
const TECH_ALLOWED_API_PATTERNS = [
  /^\/api\/tickets\/[^/]+/,           // PATCH /api/tickets/[id] and POST /api/tickets/[id]/complete
  /^\/api\/equipment\/[^/]+\/notes$/, // GET + POST /api/equipment/[id]/notes
]

function isTechAllowed(pathname: string): boolean {
  if (TECH_ALLOWED_PAGES.includes(pathname)) return true
  if (TECH_ALLOWED_PAGE_PATTERNS.some((p) => p.test(pathname))) return true
  if (TECH_ALLOWED_API_PATTERNS.some((p) => p.test(pathname))) return true
  return false
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Skip auth check for public routes
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/login') || pathname.startsWith('/forgot-password') || pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Redirect unauthenticated users to login
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Role-based access: read the pm-role cookie (set by layout.tsx on each page load)
  const role = request.cookies.get('pm-role')?.value

  if (role === 'technician') {
    if (!isTechAllowed(pathname)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // Force password change if flagged
  const mustChangePw = request.cookies.get('pm-must-change-pw')?.value
  if (
    mustChangePw === 'true' &&
    !pathname.startsWith('/change-password') &&
    !pathname.startsWith('/auth/') &&
    !pathname.startsWith('/api/')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/change-password'
    url.searchParams.set('forced', 'true')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
