'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EquipmentRow, UserRow } from '@/types/database'
import { formatPhoneNumber } from '@/lib/phone'
import { normalizeSerial, serialsMatch } from '@/lib/equipment'

type DuplicateMatch = {
  id: string
  make: string | null
  model: string | null
}

interface EquipmentFormProps {
  equipment: EquipmentRow & { customers: { name: string } | null }
  users: UserRow[]
  shipToLocations: {id: number; name: string | null; city: string | null}[]
  isTech?: boolean
}

export default function EquipmentForm({ equipment, users, shipToLocations, isTech = false }: EquipmentFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null)
  const [success, setSuccess] = useState(false)

  const [make, setMake] = useState(equipment.make ?? '')
  const [model, setModel] = useState(equipment.model ?? '')
  const [serialNumber, setSerialNumber] = useState(equipment.serial_number ?? '')
  const [description, setDescription] = useState(equipment.description ?? '')
  const [locationOnSite, setLocationOnSite] = useState(equipment.location_on_site ?? '')
  const [blanketPoNumber, setBlanketPoNumber] = useState(equipment.blanket_po_number ?? '')
  const [contactName, setContactName] = useState(equipment.contact_name ?? '')
  const [contactEmail, setContactEmail] = useState(equipment.contact_email ?? '')
  const [contactPhone, setContactPhone] = useState(equipment.contact_phone ?? '')
  const [shipToLocationId, setShipToLocationId] = useState(String(equipment.ship_to_location_id ?? ''))
  const [defaultTechId, setDefaultTechId] = useState(equipment.default_technician_id ?? '')
  const [active, setActive] = useState(equipment.active)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setDuplicate(null)
    setSuccess(false)

    const supabase = createClient()
    const normalizedSerial = normalizeSerial(serialNumber)

    // Duplicate-serial pre-check (only for managers editing serial/active, and only when the
    // target state is active with a serial and customer set).
    if (!isTech && active && normalizedSerial && equipment.customer_id) {
      const { data: candidates, error: dupError } = await supabase
        .from('equipment')
        .select('id, make, model, serial_number')
        .eq('customer_id', equipment.customer_id)
        .eq('active', true)
        .neq('id', equipment.id)
        .ilike('serial_number', `%${normalizedSerial}%`)

      if (dupError) {
        setError(dupError.message)
        setLoading(false)
        return
      }

      const match = (candidates ?? []).find((row) => serialsMatch(row.serial_number, normalizedSerial))
      if (match) {
        setDuplicate({ id: match.id, make: match.make, model: match.model })
        setLoading(false)
        return
      }
    }

    const updateData = isTech
      ? {
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
        }
      : {
          make: make || null,
          model: model || null,
          serial_number: normalizedSerial,
          description: description || null,
          location_on_site: locationOnSite || null,
          blanket_po_number: blanketPoNumber || null,
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          ship_to_location_id: shipToLocationId ? parseInt(shipToLocationId) : null,
          default_technician_id: defaultTechId || null,
          active,
        }

    // Route through the server-side equipment PATCH so the role/field
    // allowlist is enforced server-side, not just by client-side branching.
    const res = await fetch(`/api/equipment/${equipment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data?.error || 'Failed to save equipment.')
    } else {
      setSuccess(true)
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">
        Equipment Details
      </h2>
      {duplicate && (
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">
          This customer already has active equipment with that serial number
          {duplicate.make || duplicate.model
            ? ` — ${[duplicate.make, duplicate.model].filter(Boolean).join(' ')}`
            : ''}
          .{' '}
          <Link
            href={`/equipment/${duplicate.id}`}
            className="underline text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
          >
            View existing
          </Link>
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400 mb-3">Saved.</p>}
      <form onSubmit={handleSubmit} className="space-y-3 max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Make</label>
            <input type="text" value={make} onChange={(e) => setMake(e.target.value)} disabled={isTech} className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
            <input type="text" value={model} onChange={(e) => setModel(e.target.value)} disabled={isTech} className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Serial Number</label>
          <input type="text" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} disabled={isTech} className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isTech} className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location on Site</label>
          <input type="text" value={locationOnSite} onChange={(e) => setLocationOnSite(e.target.value)} disabled={isTech} className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Blanket PO Number</label>
          <input type="text" value={blanketPoNumber} onChange={(e) => setBlanketPoNumber(e.target.value)} disabled={isTech} className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact</label>
          <div className="space-y-2">
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500" />
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500" />
            <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(formatPhoneNumber(e.target.value))} placeholder="(205) 555-1234" className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ship-To Location</label>
          <select value={shipToLocationId} onChange={(e) => setShipToLocationId(e.target.value)} disabled={isTech} className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800">
            <option value="">None</option>
            {shipToLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name ?? 'Unnamed'}{loc.city ? ` — ${loc.city}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default Technician</label>
          <select value={defaultTechId} onChange={(e) => setDefaultTechId(e.target.value)} disabled={isTech} className="w-full rounded-md border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:bg-gray-50 disabled:text-gray-500 dark:disabled:bg-gray-800">
            <option value="">None</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        {!isTech && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <label htmlFor="active" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving...' : isTech ? 'Save Contact' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
