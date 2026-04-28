import { CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// Server component — reads sync_log directly. Replaces the prior client-side
// useEffect + /api/sync/status fetch, which forced a second round-trip after
// page paint. Manager+ gating is done by the caller (src/app/page.tsx).

interface SyncRow {
  sync_type: string
  started_at: string
  completed_at: string | null
  records_synced: number | null
  status: string | null
  error_message: string | null
}

export default async function SyncStatusBanner() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sync_log')
    .select('sync_type, started_at, completed_at, records_synced, status, error_message')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sync = data as SyncRow | null

  if (!sync) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">No sync history available.</p>
      </div>
    )
  }

  const isSuccess = sync.status === 'success'
  const completedAt = sync.completed_at
    ? new Date(sync.completed_at).toLocaleString()
    : 'In progress'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSuccess ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Last Sync: {sync.sync_type}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{completedAt}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {sync.records_synced !== null && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {sync.records_synced} records
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isSuccess
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
            }`}
          >
            {sync.status}
          </span>
        </div>
      </div>
      {sync.error_message && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{sync.error_message}</p>
      )}
    </div>
  )
}
