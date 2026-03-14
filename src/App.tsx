import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';

// Pages
import Landing from './pages/Landing';
import DashboardLayout from './components/DashboardLayout';
import Feed from './pages/Feed';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import Health from './pages/Health';
import AIAssistant from './pages/AIAssistant';
import Admin from './pages/Admin';
import Messages from './pages/Messages';
import Subscription from './pages/Subscription';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Landing />} />
              
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
                <Route path="health" element={<Health />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="admin" element={<Admin />} />
                <Route path="messages" element={<Messages />} />
                <Route path="subscription" element={<Subscription />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

