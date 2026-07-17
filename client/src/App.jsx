import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Movies from './pages/Movies';
import MovieDetail from './pages/MovieDetail';
import Cast from './pages/Cast';
import CastDetail from './pages/CastDetail';
import Favourites from './pages/Favourites';
import Clips from './pages/Clips';
import Collections from './pages/Collections';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationHistoryProvider } from './context/NavigationHistoryContext';
import { Loader2 } from 'lucide-react';
import './index.css';

// Loading Component
function AuthLoadingScreen() {
  return (
    <div className="flex-center" style={{ height: '100vh', width: '100vw', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
      <Loader2 className="spinner" size={40} style={{ color: 'var(--accent-color)' }} />
      <span>Restoring your session...</span>
    </div>
  );
}

// Protected route component ensures only authenticated users can access certain pages
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

// Admin route component ensures only authenticated admin users can access certain pages
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  return user && user.role === 'admin' ? children : <Navigate to="/" replace />;
}

// Guest route component ensures authenticated users cannot access login/register pages
function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  return user ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <NavigationHistoryProvider>
          <div className="app-root" data-theme="light">
            <Navbar />
            <main className="content-wrapper">
              <Routes>
                {/* Public pages (only for guests) */}
                <Route
                  path="/login"
                  element={
                    <GuestRoute>
                      <Login />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <GuestRoute>
                      <Register />
                    </GuestRoute>
                  }
                />

                {/* Protected pages */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/movies"
                  element={
                    <ProtectedRoute>
                      <Movies />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/movies/:id"
                  element={
                    <ProtectedRoute>
                      <MovieDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cast"
                  element={
                    <ProtectedRoute>
                      <Cast />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cast/:id"
                  element={
                    <ProtectedRoute>
                      <CastDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/favourites"
                  element={
                    <ProtectedRoute>
                      <Favourites />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clips"
                  element={
                    <ProtectedRoute>
                      <Clips />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/collections"
                  element={
                    <ProtectedRoute>
                      <Collections />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <Admin />
                    </AdminRoute>
                  }
                />
                {/* Catch‑all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </NavigationHistoryProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
