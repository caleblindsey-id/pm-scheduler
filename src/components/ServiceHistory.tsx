'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import StatusBadge from '@/components/StatusBadge'
import { PmTicketRow, PartUsed } from '@/types/database'

interface ServiceHistoryProps {
  tickets: PmTicketRow[]
  showBilling: boolean
  collapsible?: boolean
}

function partsCount(parts: PartUsed[] | null | undefined): number {
  return Array.isArray(parts) ? parts.length : 0
}

export default function ServiceHistory({ tickets, showBilling, collapsible = false }: ServiceHistoryProps) {
  const [expanded, setExpanded] = useState(!collapsible)

  const header = (
    <div
      className={`px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between ${collapsible ? 'cursor-pointer select-none' : ''}`}
      onClick={collapsible ? () => setExpanded(!expanded) : undefined}
    >
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
        Service History ({tickets.length})
      </h2>
      {collapsible && (
        expanded
          ? <ChevronDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          : <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
      )}
    </div>
  )

  if (tickets.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {header}
        {expanded && (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No service history.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {header}
      {expanded && (
        <>
          {/* Mobile cards */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/tickets/${t.id}`}
                className="block px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">WO-{t.work_order_number}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>
                    {t.completed_date
                      ? new Date(t.completed_date).toLocaleDateString()
                      : `${t.month}/${t.year}`}
                  </div>
                  {(t.hours_worked != null || t.additional_hours_worked != null) && (
                    <div>
                      {t.hours_worked != null && <span>PM: {t.hours_worked}h</span>}
                      {t.additional_hours_worked != null && t.additional_hours_worked > 0 && (
                        <span>{t.hours_worked != null ? ' + ' : ''}Add&apos;l: {t.additional_hours_worked}h</span>
                      )}
                    </div>
                  )}
                  {(partsCount(t.parts_used) > 0 || partsCount(t.additional_parts_used) > 0) && (
                    <div>
                      {partsCount(t.parts_used) > 0 && <span>{partsCount(t.parts_used)} PM parts</span>}
                      {partsCount(t.additional_parts_used) > 0 && (
                        <span>{partsCount(t.parts_used) > 0 ? ', ' : ''}{partsCount(t.additional_parts_used)} add&apos;l parts</span>
                      )}
                    </div>
                  )}
                  {showBilling && t.billing_amount != null && (
                    <div className="font-medium text-gray-900 dark:text-white">${t.billing_amount.toFixed(2)}</div>
                  )}
                  {t.completion_notes && (
                    <div className="text-gray-500 dark:text-gray-400 italic line-clamp-2">{t.completion_notes}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">WO #</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Hours</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Parts</th>
                  {showBilling && (
                    <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Billing</th>
                  )}
                  <th className="px-5 py-3 text-left font-medium text-gray-600 dark:text-gray-400">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-5 py-3">
                      <Link href={`/tickets/${t.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        WO-{t.work_order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                      {t.completed_date
                        ? new Date(t.completed_date).toLocaleDateString()
                        : `${t.month}/${t.year}`}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                      {t.hours_worked != null ? `${t.hours_worked}` : '—'}
                      {t.additional_hours_worked != null && t.additional_hours_worked > 0
                        ? ` + ${t.additional_hours_worked}`
                        : ''}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                      {partsCount(t.parts_used) + partsCount(t.additional_parts_used) || '—'}
                    </td>
                    {showBilling && (
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                        {t.billing_amount != null ? `$${t.billing_amount.toFixed(2)}` : '—'}
                      </td>
                    )}
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {t.completion_notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
