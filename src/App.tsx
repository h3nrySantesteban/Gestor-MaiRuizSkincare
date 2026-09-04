import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import { AppLayout } from './components/AppLayout/AppLayout'
import { Login } from './pages/Login'
import { PrivacyPolicy } from './pages/PrivacyPolicy'
import { TermsOfService } from './pages/TermsOfService'

// lazy: Dashboard/Analytics arrastran recharts, que es la parte más pesada
// del bundle — no tiene sentido bajarla antes de loguearse
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Turnos = lazy(() => import('./pages/Turnos').then((m) => ({ default: m.Turnos })))
const Pacientes = lazy(() => import('./pages/Pacientes').then((m) => ({ default: m.Pacientes })))
const PacienteDetalle = lazy(() => import('./pages/PacienteDetalle').then((m) => ({ default: m.PacienteDetalle })))
const Tratamientos = lazy(() => import('./pages/Tratamientos').then((m) => ({ default: m.Tratamientos })))
const Formularios = lazy(() => import('./pages/Formularios').then((m) => ({ default: m.Formularios })))
const Gastos = lazy(() => import('./pages/Gastos').then((m) => ({ default: m.Gastos })))
const GastosHistorial = lazy(() => import('./pages/GastosHistorial').then((m) => ({ default: m.GastosHistorial })))
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })))

// en blanco a propósito: el chunk de cada página se descarga rápido (unos
// pocos KB), y mostrar texto acá se ve como un segundo "cargando" distinto
// justo antes de que la página monte su propio skeleton — mejor nada que
// un flash de texto que no combina con nada
function PageFallback() {
  return null
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* /privacidad y /terminos quedan públicas — no se persigue la
              verificación del scope sensible de Calendar (ver CLAUDE.md),
              pero por las dudas de que el consent screen de OAuth todavía
              las referencie no cuesta nada dejarlas accesibles. */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/privacidad" element={<PrivacyPolicy />} />
          <Route path="/terminos" element={<TermsOfService />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route
              path="/turnos"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Turnos />
                </Suspense>
              }
            />
            <Route
              path="/pacientes"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Pacientes />
                </Suspense>
              }
            />
            <Route
              path="/pacientes/:id"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PacienteDetalle />
                </Suspense>
              }
            />
            <Route
              path="/tratamientos"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Tratamientos />
                </Suspense>
              }
            />
            <Route
              path="/formularios"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Formularios />
                </Suspense>
              }
            />
            <Route
              path="/gastos"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Gastos />
                </Suspense>
              }
            />
            <Route
              path="/gastos/historial"
              element={
                <Suspense fallback={<PageFallback />}>
                  <GastosHistorial />
                </Suspense>
              }
            />
            <Route
              path="/analytics"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Analytics />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
