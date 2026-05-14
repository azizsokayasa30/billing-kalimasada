import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import PortalLayout from './layouts/PortalLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Paket from './pages/Paket';
import Tagihan from './pages/Tagihan';
import InvoiceDetail from './pages/InvoiceDetail';
import Tiket from './pages/Tiket';
import Profil from './pages/Profil';

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const hydrateToken = useAuthStore((s) => s.hydrateToken);
  useEffect(() => {
    hydrateToken();
  }, [hydrateToken]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <PortalLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="paket" element={<Paket />} />
        <Route path="tagihan" element={<Tagihan />} />
        <Route path="tagihan/:id" element={<InvoiceDetail />} />
        <Route path="speedtest" element={<Navigate to="/dashboard#speedtest" replace />} />
        <Route path="tiket" element={<Tiket />} />
        <Route path="request" element={<Navigate to="/dashboard" replace />} />
        <Route path="notifikasi" element={<Navigate to="/dashboard" replace />} />
        <Route path="profil" element={<Profil />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
