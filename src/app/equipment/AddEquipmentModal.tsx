'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'

interface CustomerOption {
  id: number
  name: string
  account_number: string | null
}

interface AddEquipmentModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export default function AddEquipmentModal({
  open,
  onClose,
  onCreated,
}: AddEquipmentModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Customer combobox state
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerOption[]>([])
  const [customerId, setCustomerId] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [description, setDescription] = useState('')
  const [locationOnSite, setLocationOnSite] = useState('')

  // Debounced customer search
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([])
      setComboOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const supabase = createClient()
      const q = customerSearch.trim()
      const { data } = await supabase
        .from('customers')
        .select('id, name, account_number')
        .or(`name.ilike.%${q}%,account_number.ilike.%${q}%`)
        .order('name')
        .limit(25)
      setCustomerResults((data as CustomerOption[]) ?? [])
      setComboOpen(true)
      setSearching(false)
    }, 300)
  }, [customerSearch])

  // Close combobox on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectCustomer(c: CustomerOption) {
    setCustomerId(String(c.id))
    setCustomerSearch(c.account_number ? `${c.name} (${c.account_number})` : c.name)
    setComboOpen(false)
  }

  function resetForm() {
    setCustomerSearch('')
    setCustomerId('')
    setCustomerResults([])
    setComboOpen(false)
    setMake('')
    setModel('')
    setSerialNumber('')
    setDescription('')
    setLocationOnSite('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: insertError } = await supabase.from('equipment').insert({
      customer_id: customerId ? parseInt(customerId) : null,
      make: make || null,
      model: model || null,
      serial_number: serialNumber || null,
      description: description || null,
      location_on_site: locationOnSite || null,
      active: true,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    resetForm()
    setLoading(false)
    onCreated()
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-lg shadow-lg border border-gray-200 p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Add Equipment
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Customer combobox */}
          <div ref={comboRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer
            </label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setCustomerId('')
              }}
              onFocus={() => { if (customerResults.length > 0) setComboOpen(true) }}
              placeholder="Search by name or account number..."
              autoComplete="off"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
            {searching && (
              <p className="text-xs text-gray-400 mt-1">Searching...</p>
            )}
            {comboOpen && customerResults.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-auto text-sm">
                {customerResults.map((c) => (
                  <li
                    key={c.id}
                    onMouseDown={() => selectCustomer(c)}
                    className="px-3 py-2 cursor-pointer hover:bg-slate-50 flex justify-between items-center"
                  >
                    <span className="text-gray-900">{c.name}</span>
                    {c.account_number && (
                      <span className="text-gray-400 text-xs ml-2 shrink-0">{c.account_number}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {comboOpen && !searching && customerSearch.trim() && customerResults.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No customers found.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Serial Number
            </label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location on Site
            </label>
            <input
              type="text"
              value={locationOnSite}
              onChange={(e) => setLocationOnSite(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
