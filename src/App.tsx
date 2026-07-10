import { Navigate, Route, Routes } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel';
import AlbumView from './pages/AlbumView';
import AuthCallback from './pages/AuthCallback';
import ContributorView from './pages/ContributorView';
import Landing from './pages/Landing';

// Router + rol-guards (brief §4/§12). Guards zijn in Sprint 1 nog stubs; ze
// worden in Sprint 2 ingevuld zodra /api/me identiteit→rol oplost.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/beheer" element={<AdminPanel />} />
      <Route path="/uploaden" element={<ContributorView />} />
      <Route path="/album" element={<AlbumView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
