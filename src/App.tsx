import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute/ProtectedRoute'
import { AppLayout } from './components/AppLayout/AppLayout'
import { Login } from './pages/Login'

// lazy: Dashboard/Analytics arrastran recharts, que es la parte más pesada
// del bundle — no tiene sentido bajarla antes de loguearse
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Turnos = lazy(() => import('./pages/Turnos').then((m) => ({ default: m.Turnos })))
const Pacientes = lazy(() => import('./pages/Pacientes').then((m) => ({ default: m.Pacientes })))
const Tratamientos = lazy(() => import('./pages/Tratamientos').then((m) => ({ default: m.Tratamientos })))
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })))

function PageFallback() {
  return <div className="p-6 text-sm text-ink-muted">Cargando...</div>
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route
              path="/"
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
              path="/tratamientos"
              element={
                <Suspense fallback={<PageFallback />}>
                  <Tratamientos />
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
