import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../server/supabaseAdmin'
import { syncTurnoEvent, deleteTurnoEvent } from '../server/googleCalendar'

interface TurnoConRelaciones {
  id: string
  fecha: string
  estado: string
  google_event_id: string | null
  pacientes: { nombre_completo: string; email: string | null } | null
  turno_tratamientos: { tratamientos: { nombre: string } | null }[]
}

// Thin orchestration, igual que api/whatsapp-webhook.ts: la lógica de armar
// el evento vive en server/googleCalendar.ts. Nunca se llama desde el
// frontend directamente a Google — siempre pasa por acá con el service role,
// así el turno queda guardado en Supabase aunque la sync a Calendar falle.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed')
    return
  }

  const body = req.body as { turnoId?: string; action?: string; googleEventId?: string }

  try {
    if (body.action === 'delete') {
      if (!body.googleEventId) {
        res.status(400).json({ error: 'Falta googleEventId' })
        return
      }
      await deleteTurnoEvent(body.googleEventId)
      res.status(200).json({ ok: true })
      return
    }

    if (!body.turnoId) {
      res.status(400).json({ error: 'Falta turnoId' })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('turnos')
      .select(
        'id, fecha, estado, google_event_id, pacientes ( nombre_completo, email ), turno_tratamientos ( tratamientos ( nombre ) )',
      )
      .eq('id', body.turnoId)
      .single()

    if (error || !data) {
      res.status(404).json({ error: error?.message ?? 'Turno no encontrado' })
      return
    }

    const turno = data as unknown as TurnoConRelaciones
    const googleEventId = await syncTurnoEvent({
      fecha: turno.fecha,
      estado: turno.estado,
      googleEventId: turno.google_event_id,
      pacienteNombre: turno.pacientes?.nombre_completo ?? 'Paciente',
      pacienteEmail: turno.pacientes?.email ?? null,
      tratamientos: turno.turno_tratamientos.map((t) => t.tratamientos?.nombre).filter((n): n is string => Boolean(n)),
    })

    if (googleEventId !== turno.google_event_id) {
      await supabaseAdmin.from('turnos').update({ google_event_id: googleEventId }).eq('id', turno.id)
    }

    res.status(200).json({ googleEventId })
  } catch (err) {
    console.error('Error sincronizando con Google Calendar', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Error desconocido' })
  }
}
