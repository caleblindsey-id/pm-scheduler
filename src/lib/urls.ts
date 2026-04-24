// Canonical public URL for outbound links (emails, PDFs, clipboard copies).
// Prefer the env-configured value so links don't bake in whatever hostname the
// staff user happened to be browsing (e.g. a stale pm-scheduler-* alias).
// Falls back to window.location.origin on the client when the env var isn't
// set, and to an empty string on the server to avoid crashing SSR.
export function getPublicAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}
