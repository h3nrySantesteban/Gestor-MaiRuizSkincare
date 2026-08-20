import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseAdmin } from '../server/supabaseAdmin.js'
import { sendReminderTemplate } from '../server/whatsappClient.js'
import { requireEnv } from '../server/env.js'
import { formatArgentinaDate, formatArgentinaTime, getArgentinaTomorrowRangeUtc } from '../server/argentinaTime.js'

interface TurnoParaRecordar {
  id: string
  fecha: string
  pacientes: { nombre_completo: string; telefono: string | null } | null
  turno_tratamientos: { tratamientos: { nombre: string } | null }[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // endpoint público que manda mensajes reales y muta turnos: sin este
  // secreto no corre, no queda "abierto" por accidente si falta configurar
  const auth = req.headers.authorization
  if (auth !== `Bearer ${requireEnv('CRON_SECRET')}`) {
    res.status(401).send('Unauthorized')
    return
  }

  const { start, end } = getArgentinaTomorrowRangeUtc()

  const { data, error } = await supabaseAdmin
    .from('turnos')
    .select('id, fecha, pacientes ( nombre_completo, telefono ), turno_tratamientos ( tratamientos ( nombre ) )')
    .gte('fecha', start.toISOString())
    .lte('fecha', end.toISOString())
    .eq('estado', 'Agendado')
    .is('reminder_sent_at', null)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  const turnos = (data ?? []) as unknown as TurnoParaRecordar[]
  let enviados = 0
  let omitidos = 0

  for (const turno of turnos) {
    const telefono = turno.pacientes?.telefono
    if (!telefono) {
      omitidos++
      continue
    }
    const tratamientoNombre =
      turno.turno_tratamientos
        .map((t) => t.tratamientos?.nombre)
        .filter((nombre): nombre is string => Boolean(nombre))
        .join(', ') || 'tu turno'

    try {
      await sendReminderTemplate(telefono, {
        pacienteNombre: turno.pacientes?.nombre_completo ?? '',
        fecha: formatArgentinaDate(turno.fecha),
        hora: formatArgentinaTime(turno.fecha),
        tratamiento: tratamientoNombre,
      })
      await supabaseAdmin.from('turnos').update({ reminder_sent_at: new Date().toISOString() }).eq('id', turno.id)
      enviados++
    } catch (err) {
      console.error(`No se pudo enviar recordatorio para turno ${turno.id}`, err)
    }
  }

  res.status(200).json({ turnosEncontrados: turnos.length, enviados, omitidos })
}
