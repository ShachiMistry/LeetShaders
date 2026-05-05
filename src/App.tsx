import { Route, Routes, Navigate } from 'react-router-dom';
import ChallengeList from './pages/ChallengeList';
import ChallengePage from './pages/ChallengePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/challenges" replace />} />
      <Route path="/challenges" element={<ChallengeList />} />
      <Route path="/challenges/:slug" element={<ChallengePage />} />
      <Route path="*" element={<Navigate to="/challenges" replace />} />
    </Routes>
  );
}
