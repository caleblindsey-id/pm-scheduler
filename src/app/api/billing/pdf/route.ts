import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { BillingDocument } from '@/lib/pdf/billing-template'
import { createClient } from '@/lib/supabase/server'

// ============================================================
// Types
// ============================================================

interface PartLine {
  description: string
  quantity: number
  unit_price: number
}

interface BillingTicket {
  id: string
  customerName: string
  accountNumber: string | null
  billingAddress: string | null
  arTerms: string | null
  equipmentMake: string | null
  equipmentModel: string | null
  serialNumber: string | null
  locationOnSite: string | null
  technicianName: string
  completedDate: string
  hoursWorked: number | null
  completionNotes: string | null
  partsUsed: PartLine[]
  billingAmount: number | null
}

// Raw Supabase join shape
interface RawTicket {
  id: string
  completed_date: string | null
  hours_worked: number | null
  completion_notes: string | null
  parts_used: Array<{
    synergy_product_id?: number
    quantity: number
    description?: string
    unit_price: number
  }> | null
  billing_amount: number | null
  customers: {
    name: string
    account_number: string | null
    ar_terms: string | null
    billing_address: string | null
  } | null
  equipment: {
    make: string | null
    model: string | null
    serial_number: string | null
    location_on_site: string | null
  } | null
  technician: { name: string } | null
}

// ============================================================
// POST /api/billing/pdf
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // --- Parse and validate body ---
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { ticketIds, month, year } = body as {
      ticketIds?: unknown
      month?: unknown
      year?: unknown
    }

    if (
      !Array.isArray(ticketIds) ||
      ticketIds.length === 0 ||
      !ticketIds.every((id) => typeof id === 'string')
    ) {
      return NextResponse.json(
        { error: 'ticketIds must be a non-empty array of strings' },
        { status: 400 }
      )
    }

    const monthNum = Number(month)
    const yearNum = Number(year)

    if (
      !Number.isInteger(monthNum) ||
      monthNum < 1 ||
      monthNum > 12 ||
      !Number.isInteger(yearNum) ||
      yearNum < 2000 ||
      yearNum > 2100
    ) {
      return NextResponse.json(
        { error: 'month must be 1–12 and year must be a valid 4-digit year' },
        { status: 400 }
      )
    }

    // --- Fetch ticket data from Supabase ---
    const supabase = await createClient()

    const { data: rawTickets, error: ticketsError } = await supabase
      .from('pm_tickets')
      .select(`
        id,
        completed_date,
        hours_worked,
        completion_notes,
        parts_used,
        billing_amount,
        customers(name, account_number, ar_terms, billing_address),
        equipment(make, model, serial_number, location_on_site),
        technician:users!assigned_technician_id(name)
      `)
      .in('id', ticketIds as string[])

    if (ticketsError) {
      console.error('[billing/pdf] Supabase fetch error:', ticketsError)
      return NextResponse.json({ error: 'Failed to fetch ticket data' }, { status: 500 })
    }

    if (!rawTickets || rawTickets.length === 0) {
      return NextResponse.json({ error: 'No tickets found for the provided IDs' }, { status: 404 })
    }

    // --- Collect all unique synergy_product_ids to resolve descriptions ---
    const productIdSet = new Set<number>()
    for (const ticket of rawTickets as RawTicket[]) {
      for (const part of ticket.parts_used ?? []) {
        if (typeof part.synergy_product_id === 'number') {
          productIdSet.add(part.synergy_product_id)
        }
      }
    }

    // Build a description lookup map from the products table
    const productDescMap = new Map<number, string>()
    if (productIdSet.size > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('synergy_id, description')
        .in('synergy_id', Array.from(productIdSet).map(String))

      for (const p of products ?? []) {
        if (p.synergy_id && p.description) {
          productDescMap.set(Number(p.synergy_id), p.description)
        }
      }
    }

    // --- Map raw tickets to BillingTicket[] ---
    const tickets: BillingTicket[] = (rawTickets as RawTicket[]).map((raw) => {
      const partsUsed: PartLine[] = (raw.parts_used ?? []).map((part) => ({
        description:
          (typeof part.synergy_product_id === 'number' &&
            productDescMap.get(part.synergy_product_id)) ||
          part.description ||
          'Unknown part',
        quantity: part.quantity,
        unit_price: part.unit_price,
      }))

      const technicianEntry = raw.technician
      const technicianName =
        Array.isArray(technicianEntry)
          ? (technicianEntry[0]?.name ?? '—')
          : (technicianEntry?.name ?? '—')

      return {
        id: raw.id,
        customerName: raw.customers?.name ?? '—',
        accountNumber: raw.customers?.account_number ?? null,
        billingAddress: raw.customers?.billing_address ?? null,
        arTerms: raw.customers?.ar_terms ?? null,
        equipmentMake: raw.equipment?.make ?? null,
        equipmentModel: raw.equipment?.model ?? null,
        serialNumber: raw.equipment?.serial_number ?? null,
        locationOnSite: raw.equipment?.location_on_site ?? null,
        technicianName,
        completedDate: raw.completed_date
          ? new Date(raw.completed_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : '—',
        hoursWorked: raw.hours_worked,
        completionNotes: raw.completion_notes,
        partsUsed,
        billingAmount: raw.billing_amount,
      }
    })

    // --- Render PDF ---
    const exportedAt = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(BillingDocument as any, {
      tickets,
      month: monthNum,
      year: yearNum,
      exportedAt,
    })

    let buffer: Buffer
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buffer = await renderToBuffer(element as any)
    } catch (renderErr) {
      console.error('[billing/pdf] renderToBuffer error:', renderErr)
      return NextResponse.json({ error: 'Failed to render PDF' }, { status: 500 })
    }

    // --- Mark tickets as exported ---
    const { error: updateError } = await supabase
      .from('pm_tickets')
      .update({ billing_exported: true })
      .in('id', ticketIds as string[])

    if (updateError) {
      // Log but don't fail — the PDF was generated; the coordinator can retry the mark
      console.error('[billing/pdf] Failed to mark tickets as exported:', updateError)
    }

    // --- Return PDF ---
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
      new Date(yearNum, monthNum - 1)
    )
    const filename = `PM-Billing-${monthName}-${yearNum}.pdf`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[billing/pdf] Unexpected error:', err)
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 })
  }
}
