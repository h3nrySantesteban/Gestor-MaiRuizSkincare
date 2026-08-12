import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { mapNotificacionRow, type Notificacion, type NotificacionRow } from '../types/notificacion'

const NOTIFICACION_SELECT = `
  id, turno_id, tipo, mensaje_original, leida, created_at,
  turnos ( fecha, pacientes ( nombre_completo ) )
`

export function useNotifications() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('notificaciones')
      .select(NOTIFICACION_SELECT)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error && data) {
      setNotificaciones((data as unknown as NotificacionRow[]).map(mapNotificacionRow))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch resolves async, setState happens in a later microtask
    refetch()

    // Refleja en vivo lo que hace api/whatsapp-webhook.ts (confirmaciones,
    // cancelaciones, pedidos de reprogramar) mientras Mai tiene la app abierta.
    const channel = supabase
      .channel('notificaciones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, () => {
        refetch()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [refetch])

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNotificaciones((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
  }, [])

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notificaciones.filter((n) => !n.leida).map((n) => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notificaciones').update({ leida: true }).in('id', unreadIds)
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })))
  }, [notificaciones])

  const unreadCount = notificaciones.filter((n) => !n.leida).length

  return { notificaciones, unreadCount, loading, markAsRead, markAllAsRead }
}
