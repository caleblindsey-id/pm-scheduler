'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { TicketDetail } from '@/lib/db/tickets'
import { PartUsed } from '@/types/database'

interface TicketActionsProps {
  ticket: TicketDetail
}

export default function TicketActions({ ticket }: TicketActionsProps) {
  const router = useRouter()
  const pathname = usePathname()

  const billingType = ticket.schedule?.billing_type ?? null
  const flatRate = ticket.schedule?.flat_rate ?? null
  const isFlatRate = billingType === 'flat_rate' && flatRate != null

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Completion form state
  const [completedDate, setCompletedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [hoursWorked, setHoursWorked] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [billingAmount, setBillingAmount] = useState(
    isFlatRate && flatRate != null ? String(flatRate) : ''
  )
  const [parts, setParts] = useState<
    { description: string; quantity: number; unitPrice: number }[]
  >([])

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start ticket')
      }
      router.push(pathname)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const partsUsed: PartUsed[] = parts.map((p) => ({
        synergy_product_id: null,
        description: p.description,
        quantity: p.quantity,
        unit_price: p.unitPrice,
      }))

      const res = await fetch(`/api/tickets/${ticket.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedDate,
          hoursWorked: parseFloat(hoursWorked) || 0,
          partsUsed,
          completionNotes,
          billingAmount: parseFloat(billingAmount) || 0,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to complete ticket')
      }
      router.push(pathname)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function addPart() {
    setParts([...parts, { description: '', quantity: 1, unitPrice: 0 }])
  }

  function updatePart(
    index: number,
    field: 'description' | 'quantity' | 'unitPrice',
    value: string | number
  ) {
    const updated = [...parts]
    if (field === 'description') {
      updated[index].description = value as string
    } else if (field === 'quantity') {
      updated[index].quantity = Number(value)
    } else {
      updated[index].unitPrice = Number(value)
    }
    setParts(updated)
  }

  function removePart(index: number) {
    setParts(parts.filter((_, i) => i !== index))
  }

  const partsTotal = parts.reduce(
    (sum, p) => sum + p.quantity * p.unitPrice,
    0
  )

  // Unassigned or assigned: show Start button
  if (ticket.status === 'unassigned' || ticket.status === 'assigned') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
          Actions
        </h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleStart}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Starting...' : 'Start Work'}
        </button>
      </div>
    )
  }

  // In progress: show completion form
  if (ticket.status === 'in_progress') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
          Complete Ticket
        </h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <form onSubmit={handleComplete} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Completion Date
            </label>
            <input
              type="date"
              required
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 w-full focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hours Worked
            </label>
            <input
              type="number"
              step="0.25"
              min="0"
              required
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 w-full focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="0.00"
            />
          </div>

          {/* Flat rate base — informational, shown above additional work */}
          {isFlatRate && (
            <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-md border border-blue-100">
              <span className="text-sm font-medium text-blue-800">PM Service (Flat Rate)</span>
              <span className="text-sm font-semibold text-blue-800">${flatRate!.toFixed(2)}</span>
            </div>
          )}

          {/* Parts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {isFlatRate ? 'Additional Work (beyond PM agreement)' : 'Parts Used'}
              </label>
              <button
                type="button"
                onClick={addPart}
                className="text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                + Add Part
              </button>
            </div>
            {parts.length > 0 && (
              <div className="space-y-2">
                {parts.map((part, i) => (
                  <div key={`new-part-${i}`} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Description"
                      value={part.description}
                      onChange={(e) =>
                        updatePart(i, 'description', e.target.value)
                      }
                      className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={part.quantity}
                      onChange={(e) =>
                        updatePart(i, 'quantity', e.target.value)
                      }
                      className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Price"
                      value={part.unitPrice}
                      onChange={(e) =>
                        updatePart(i, 'unitPrice', e.target.value)
                      }
                      className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => removePart(i)}
                      className="text-gray-400 hover:text-red-500 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Parts total: ${partsTotal.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Completion Notes
            </label>
            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              rows={3}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 w-full focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Notes about the work performed..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Billing Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={billingAmount}
              onChange={(e) => setBillingAmount(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 w-full focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="0.00"
            />
            {(parts.length > 0 || (isFlatRate && parseFloat(hoursWorked) > 0)) && (
              <p className="text-xs text-gray-500 mt-1">
                {isFlatRate
                  ? `Suggested: $${(flatRate! + partsTotal + (parseFloat(hoursWorked) || 0) * 75).toFixed(2)} (flat rate + additional parts + $75/hr labor)`
                  : `Suggested (T&M): $${(partsTotal + (parseFloat(hoursWorked) || 0) * 75).toFixed(2)} (parts + $75/hr labor)`
                }
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Completing...' : 'Mark Complete'}
          </button>
        </form>
      </div>
    )
  }

  // Completed or billed: read-only completion data
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
        Completion Details
      </h2>
      {isFlatRate && flatRate != null && (
        <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-md border border-blue-100 mb-4">
          <span className="text-sm font-medium text-blue-800">PM Service (Flat Rate)</span>
          <span className="text-sm font-semibold text-blue-800">${flatRate.toFixed(2)}</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <div>
          <span className="text-gray-500">Completed Date</span>
          <p className="text-gray-900 font-medium">
            {ticket.completed_date
              ? new Date(ticket.completed_date).toLocaleDateString()
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Hours Worked</span>
          <p className="text-gray-900 font-medium">
            {ticket.hours_worked ?? '—'}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Billing Amount</span>
          <p className="text-gray-900 font-medium">
            {ticket.billing_amount != null
              ? `$${ticket.billing_amount.toFixed(2)}`
              : '—'}
          </p>
        </div>
        <div>
          <span className="text-gray-500">Billing Exported</span>
          <p className="text-gray-900 font-medium">
            {ticket.billing_exported ? 'Yes' : 'No'}
          </p>
        </div>
      </div>
      {ticket.parts_used && ticket.parts_used.length > 0 && (
        <div className="mt-4">
          <span className="text-sm text-gray-500">
            {isFlatRate ? 'Additional Work' : 'Parts Used'}
          </span>
          <div className="mt-1 space-y-1">
            {ticket.parts_used.map((part, i) => (
              <div key={`${part.synergy_product_id ?? 'new'}-${i}`} className="text-sm text-gray-900">
                {part.description} — Qty: {part.quantity} @ $
                {part.unit_price.toFixed(2)}
              </div>
            ))}
          </div>
        </div>
      )}
      {ticket.completion_notes && (
        <div className="mt-4">
          <span className="text-sm text-gray-500">Notes</span>
          <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
            {ticket.completion_notes}
          </p>
        </div>
      )}
    </div>
  )
}
