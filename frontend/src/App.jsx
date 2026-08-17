import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// ── Pages Fotografer ──────────────────────────────────────────
import LoginPage        from './pages/LoginPage';
import DashboardPage    from './pages/DashboardPage';
import SesiDetailPage   from './pages/SesiDetailPage';
import UploadPage       from './pages/UploadPage';

// ── Pages Klien ───────────────────────────────────────────────
import KlienLanding     from './pages/KlienLanding';   // Halaman pilih mode
import KlienPage        from './pages/KlienPage';       // Galeri foto
import KlienFotoDetail  from './pages/KlienFotoDetail'; // Detail + seleksi

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Fotografer ─────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={
          <PrivateRoute><DashboardPage /></PrivateRoute>
        } />
        <Route path="/sesi/:sesiId" element={
          <PrivateRoute><SesiDetailPage /></PrivateRoute>
        } />
        <Route path="/sesi/:sesiId/upload" element={
          <PrivateRoute><UploadPage /></PrivateRoute>
        } />

        {/* ── Klien — alur: landing → galeri → detail foto ─ */}
        {/* 1. Halaman landing: klien pilih mode */}
        <Route path="/k/:token"              element={<KlienLanding />} />
        {/* 2. Galeri foto dengan mode yang sudah dipilih */}
        <Route path="/k/:token/galeri"       element={<KlienPage />} />
        {/* 3. Detail + seleksi satu foto */}
        <Route path="/k/:token/foto/:fotoId" element={<KlienFotoDetail />} />

        {/* ── Fallback ───────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
