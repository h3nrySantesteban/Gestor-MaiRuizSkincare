// One-off: segunda pasada sobre lo que vincular-formularios-por-nombre.js /
// relinkear-formularios-por-id.js no pudieron resolver — usa teléfono/email
// de la respuesta como pista extra (no solo nombre) para:
//   a) desambiguar casos donde el nombre matcheaba MÁS de un paciente
//      (si el teléfono/email solo coincide con UNO de los candidatos, ese
//      es), y
//   b) resolver respuestas que no matcheaban NINGÚN paciente por nombre,
//      cuando el teléfono/email SÍ coincide con un paciente ya cargado
//      (nombre distinto en el form — apodo, orden invertido, nombre
//      completo vs. corto, etc.)
//
// Solo auto-vincula (con --commit) los casos de "alta confianza": el
// teléfono o email matchea EXACTAMENTE UN paciente Y el nombre del form es
// razonablemente compatible (uno contiene al otro, normalizado) — evita
// linkear por un teléfono compartido (ej. de un familiar) a alguien con un
// nombre totalmente distinto.
//
// Todo lo demás queda en un reporte para revisar a mano: ambiguos que
// siguen ambiguos (probable paciente duplicado en el catálogo), teléfono
// que matchea a alguien con nombre distinto, y sin ninguna pista (se listan
// con las 3 sugerencias de nombre más parecidas, por si es un typo).
//
// Uso:
//   node --env-file=.env.local scripts/revisar-formularios-restantes.js            (solo reporte, no linkea nada)
//   node --env-file=.env.local scripts/revisar-formularios-restantes.js --commit   (aplica los de alta confianza)

import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — correr con --env-file=.env.local')
  process.exit(1)
}
globalThis.WebSocket ??= class {}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function normalizarTelefono(raw) {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('549')) return digits.length === 13 ? digits : null
  if (digits.startsWith('54')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 11 && digits.startsWith('9')) digits = digits.slice(1)
  return digits.length === 10 ? `549${digits}` : null
}

function normNombre(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// "compatible" a propósito laxo: cubre apodos parciales, orden invertido
// (apellido nombre) y nombre corto vs. completo — cualquiera de los dos
// normalizados contenido en el otro, palabra por palabra
function nombresCompatibles(a, b) {
  const wa = new Set(normNombre(a).split(' ').filter(Boolean))
  const wb = new Set(normNombre(b).split(' ').filter(Boolean))
  if (wa.size === 0 || wb.size === 0) return false
  const [chico, grande] = wa.size <= wb.size ? [wa, wb] : [wb, wa]
  for (const palabra of chico) {
    if (!grande.has(palabra)) return false
  }
  return true
}

// Levenshtein simple — solo para sugerir candidatos en el reporte, nunca
// para auto-vincular
function distancia(a, b) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

async function fetchAll(table, select, filtro) {
  const rows = []
  let from = 0
  const PAGE_SIZE = 1000
  for (;;) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1)
    if (filtro) query = filtro(query)
    const { data, error } = await query
    if (error) {
      console.error(`Error leyendo ${table}: ${error.message}`)
      process.exit(1)
    }
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function main() {
  console.log(COMMIT ? '=== Revisar formularios restantes: modo COMMIT ===' : '=== Revisar formularios restantes: modo SIMULACIÓN ===')

  const pacientes = await fetchAll('pacientes', 'id, nombre_completo, telefono, email')
  const sinAsignar = await fetchAll('respuestas_formulario', 'id, respuestas', (q) => q.is('paciente_id', null))
  console.log(`${sinAsignar.length} respuesta(s) sin asignar, ${pacientes.length} pacientes en el catálogo.`)

  const porTelefono = new Map()
  for (const p of pacientes) {
    const norm = normalizarTelefono(p.telefono)
    if (norm) porTelefono.set(norm, [...(porTelefono.get(norm) ?? []), p])
  }
  const porEmail = new Map()
  for (const p of pacientes) {
    if (p.email) {
      const key = p.email.trim().toLowerCase()
      porEmail.set(key, [...(porEmail.get(key) ?? []), p])
    }
  }
  const pacientesPorNombreNorm = new Map()
  for (const p of pacientes) {
    const key = normNombre(p.nombre_completo)
    pacientesPorNombreNorm.set(key, [...(pacientesPorNombreNorm.get(key) ?? []), p])
  }

  const altaConfianza = []
  const ambiguoSinResolver = []
  const telefonoNombreDistinto = []
  const sinPistas = []

  for (const r of sinAsignar) {
    const nombreForm = r.respuestas?.['Nombre y apellido']?.trim() || ''
    const tel = normalizarTelefono(r.respuestas?.['Teléfono'])
    const email = r.respuestas?.['Dirección de correo electrónico']?.trim().toLowerCase()

    const candidatosNombre = pacientesPorNombreNorm.get(normNombre(nombreForm)) ?? []
    const candidatosTel = tel ? (porTelefono.get(tel) ?? []) : []
    const candidatosEmail = email ? (porEmail.get(email) ?? []) : []

    // unión de candidatos por contacto (tel + email), sin duplicar por id
    const porId = new Map()
    for (const p of [...candidatosTel, ...candidatosEmail]) porId.set(p.id, p)
    const candidatosContacto = [...porId.values()]

    if (candidatosContacto.length === 1) {
      const candidato = candidatosContacto[0]
      if (nombresCompatibles(nombreForm, candidato.nombre_completo)) {
        altaConfianza.push({ respuestaId: r.id, nombreForm, pacienteId: candidato.id, nombrePaciente: candidato.nombre_completo })
      } else {
        telefonoNombreDistinto.push({ respuestaId: r.id, nombreForm, pacienteId: candidato.id, nombrePaciente: candidato.nombre_completo, tel: r.respuestas?.['Teléfono'], email: r.respuestas?.['Dirección de correo electrónico'] })
      }
      continue
    }
    if (candidatosContacto.length > 1) {
      ambiguoSinResolver.push({ respuestaId: r.id, nombreForm, candidatos: candidatosContacto.map((p) => ({ id: p.id, nombre: p.nombre_completo, telefono: p.telefono, email: p.email })) })
      continue
    }
    if (candidatosNombre.length > 1) {
      ambiguoSinResolver.push({ respuestaId: r.id, nombreForm, candidatos: candidatosNombre.map((p) => ({ id: p.id, nombre: p.nombre_completo, telefono: p.telefono, email: p.email })) })
      continue
    }

    // sin ninguna pista de contacto ni nombre exacto — sugerir los 3
    // nombres más parecidos (edición mínima) solo como pista, no se linkea
    const nombreNorm = normNombre(nombreForm)
    const sugerencias = pacientes
      .map((p) => ({ p, dist: distancia(nombreNorm, normNombre(p.nombre_completo)) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3)
      .filter((s) => s.dist <= 4) // corta sugerencias que ya son un nombre totalmente distinto
      .map((s) => ({ nombre: s.p.nombre_completo, distancia: s.dist }))
    sinPistas.push({ respuestaId: r.id, nombreForm, sugerencias })
  }

  console.log(`\nAlta confianza (teléfono/email matchea 1 solo paciente, nombre compatible): ${altaConfianza.length}`)
  for (const a of altaConfianza) console.log(`  - "${a.nombreForm}" -> ${a.nombrePaciente} (${a.pacienteId})`)

  console.log(`\n⚠️  Teléfono/email matchea un paciente con nombre MUY distinto (revisar — puede ser un familiar): ${telefonoNombreDistinto.length}`)
  for (const t of telefonoNombreDistinto) console.log(`  - "${t.nombreForm}" (tel ${t.tel}, email ${t.email}) -> ¿${t.nombrePaciente}? (${t.pacienteId}), respuesta ${t.respuestaId}`)

  console.log(`\n⚠️  Ambiguo — sigue matcheando más de un paciente (posible duplicado en el catálogo): ${ambiguoSinResolver.length}`)
  for (const a of ambiguoSinResolver) {
    console.log(`  - "${a.nombreForm}" (respuesta ${a.respuestaId}):`)
    for (const c of a.candidatos) console.log(`      · ${c.nombre} (${c.id}) — tel: ${c.telefono ?? '—'}, email: ${c.email ?? '—'}`)
  }

  console.log(`\n⚠️  Sin ninguna pista (revisar a mano desde /formularios): ${sinPistas.length}`)
  for (const s of sinPistas) {
    const sug = s.sugerencias.length > 0 ? s.sugerencias.map((x) => `${x.nombre} (dist. ${x.distancia})`).join(', ') : 'sin sugerencias cercanas'
    console.log(`  - "${s.nombreForm}" (respuesta ${s.respuestaId}) — ¿tal vez? ${sug}`)
  }

  if (!COMMIT) {
    console.log('\nEsto fue una simulación — no se vinculó nada. Correr de nuevo con --commit para aplicar los de "alta confianza".')
    return
  }

  let vinculadas = 0
  for (const a of altaConfianza) {
    const { error } = await supabase.from('respuestas_formulario').update({ paciente_id: a.pacienteId }).eq('id', a.respuestaId)
    if (error) {
      console.error(`  ${a.nombreForm}: error al vincular — ${error.message}`)
      continue
    }
    vinculadas += 1
  }
  console.log(`\nVinculadas: ${vinculadas} / ${altaConfianza.length}`)
}

main()
