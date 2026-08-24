import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import { AppLayout } from './components/AppLayout/AppLayout'
import { Login } from './pages/Login'
import { Landing } from './pages/Landing'
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
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })))

function PageFallback() {
  return <div className="p-6 text-sm text-ink-muted">Cargando...</div>
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* públicas a propósito: Google exige que la página principal, la
              política de privacidad y los términos de servicio sean
              accesibles sin login para la revisión del scope sensible de
              Calendar */}
          <Route path="/" element={<Landing />} />
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
