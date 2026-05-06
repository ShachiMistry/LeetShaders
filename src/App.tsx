import { Route, Routes, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import ChallengeList from './pages/ChallengeList';
import ChallengePage from './pages/ChallengePage';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/challenges" element={<ChallengeList />} />
          <Route path="/challenges/:slug" element={<ChallengePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </ErrorBoundary>
  );
}
