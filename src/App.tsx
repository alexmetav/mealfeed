import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';

// Pages
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import DashboardLayout from './components/DashboardLayout';
import Feed from './pages/Feed';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import UserProfile from './pages/UserProfile';
import Health from './pages/Health';
import AIAssistant from './pages/AIAssistant';
import Admin from './pages/Admin';
import Messages from './pages/Messages';
import Subscription from './pages/Subscription';
import Rewards from './pages/Rewards';
import Recommendations from './pages/Recommendations';
import Notifications from './pages/Notifications';
import Leaderboard from './pages/Leaderboard';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

import { PointsProvider } from './context/PointsContext';

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PointsProvider>
            <Router>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Feed />} />
                  <Route path="explore" element={<Feed />} />
                  <Route path="saved" element={<Feed />} />
                  <Route path="settings" element={<Profile />} />
                  <Route path="upload" element={<Upload />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="user/:id" element={<UserProfile />} />
                  <Route path="health" element={<Health />} />
                  <Route path="recommendations" element={<Recommendations />} />
                  <Route path="rewards" element={<Rewards />} />
                  <Route path="leaderboard" element={<Leaderboard />} />
                  <Route path="ai-assistant" element={<AIAssistant />} />
                  <Route path="admin" element={
                    <AdminRoute>
                      <Admin />
                    </AdminRoute>
                  } />
                  <Route path="messages" element={<Messages />} />
                  <Route path="subscription" element={<Subscription />} />
                  <Route path="notifications" element={<Notifications />} />
                </Route>
              </Routes>
            </Router>
          </PointsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

