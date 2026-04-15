'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TicketPhoto } from '@/types/database'

export default function ReadOnlyPhotos({ photos }: { photos: TicketPhoto[] }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const supabase = createClient()
    Promise.all(
      photos.map(async (p) => {
        const { data } = await supabase.storage
          .from('ticket-photos')
          .createSignedUrl(p.storage_path, 3600)
        return data?.signedUrl ?? ''
      })
    ).then(setUrls)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (urls.length === 0 && photos.length > 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm text-gray-500 dark:text-gray-400">Service Photos</span>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {urls.map((url, i) => (
          url ? (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-md overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Service photo ${i + 1}`} className="w-full h-full object-cover" />
            </a>
          ) : null
        ))}
      </div>
    </div>
  )
}
