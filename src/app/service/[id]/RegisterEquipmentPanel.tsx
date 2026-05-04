'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  ticketId: string
  customerId: number
  shipToId: number | null
  make: string | null
  model: string | null
  serial: string | null
  onDone: () => void
  onCancel: () => void
}

const inputClass =
  'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500'
const labelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

export default function RegisterEquipmentPanel({
  ticketId,
  customerId,
  shipToId,
  make: initialMake,
  model: initialModel,
  serial: initialSerial,
  onDone,
  onCancel,
}: Props) {
  const [make, setMake] = useState(initialMake ?? '')
  const [model, setModel] = useState(initialModel ?? '')
  const [serial, setSerial] = useState(initialSerial ?? '')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictId, setConflictId] = useState<string | null>(null)

  async function linkToTicket(equipmentId: string) {
    const res = await fetch(`/api/service-tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipment_id: equipmentId,
        equipment_make: null,
        equipment_model: null,
        equipment_serial_number: null,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error ?? 'Failed to link equipment to ticket.')
    }
  }

  async function handleRegister() {
    if (!make.trim() && !model.trim()) {
      setError('Enter at least a make or model.')
      return
    }
    setLoading(true)
    setError(null)
    setConflictId(null)

    try {
      const eqRes = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          ship_to_location_id: shipToId ?? undefined,
          make: make || undefined,
          model: model || undefined,
          serial_number: serial || undefined,
          description: description || undefined,
          location_on_site: location || undefined,
        }),
      })
      const eqData = await eqRes.json().catch(() => ({}))

      if (eqRes.status === 409) {
        setConflictId(eqData.existing_id ?? null)
        setError('Equipment with this serial number already exists for this customer.')
        setLoading(false)
        return
      }
      if (!eqRes.ok) {
        setError(eqData.error ?? 'Failed to create equipment profile.')
        setLoading(false)
        return
      }

      await linkToTicket(eqData.id)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
      setLoading(false)
    }
  }

  async function handleLinkExisting() {
    if (!conflictId) return
    setLoading(true)
    setError(null)
    try {
      await linkToTicket(conflictId)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="mt-2 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 space-y-3">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Register equipment profile</p>

      {error && (
        <div className="space-y-1">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          {conflictId && (
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/equipment/${conflictId}`}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                View existing equipment
              </Link>
              <span className="text-xs text-gray-400">or</span>
              <button
                type="button"
                onClick={handleLinkExisting}
                disabled={loading}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
              >
                Link this ticket to the existing profile
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Make</label>
          <input type="text" value={make} onChange={(e) => { setMake(e.target.value); setConflictId(null) }} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Model</label>
          <input type="text" value={model} onChange={(e) => { setModel(e.target.value); setConflictId(null) }} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Serial Number</label>
        <input type="text" value={serial} onChange={(e) => { setSerial(e.target.value); setConflictId(null) }} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelClass}>Notes / Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Location on Site</label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleRegister}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium text-white bg-slate-700 hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500 rounded-md disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving…' : 'Register'}
        </button>
      </div>
    </div>
  )
}
