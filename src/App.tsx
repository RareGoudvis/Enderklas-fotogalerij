import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAdmin, RequireAuth } from './lib/auth';
import AdminPanel from './pages/AdminPanel';
import AlbumView from './pages/AlbumView';
import AuthCallback from './pages/AuthCallback';
import ContributorView from './pages/ContributorView';
import Landing from './pages/Landing';

// Router + rol-guards (brief §4/§12). AuthProvider levert de identiteit via
// /api/me; RequireAuth/RequireAdmin bewaken de staff-routes. De publieke
// albumroute (/album) en de landing zijn open.
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/beheer"
          element={
            <RequireAdmin>
              <AdminPanel />
            </RequireAdmin>
          }
        />
        <Route
          path="/uploaden"
          element={
            <RequireAuth>
              <ContributorView />
            </RequireAuth>
          }
        />
        <Route path="/album" element={<AlbumView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
