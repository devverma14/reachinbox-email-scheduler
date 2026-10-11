import React, { useState, useEffect } from 'react';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { authApi } from './services/api';
import { User, SlackDetails } from './types';
import { RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackDetails, setSlackDetails] = useState<SlackDetails | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const checkAuth = async () => {
    try {
      const data = await authApi.getMe();
      setUser(data.user);
      setSlackConnected(data.slackConnected);
      setSlackDetails(data.slackDetails);
    } catch (err) {
      setUser(null);
      setSlackConnected(false);
      setSlackDetails(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setSlackConnected(false);
      setSlackDetails(null);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-200 animate-pulse">
            R
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Connecting to ReachInbox Scheduler...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={checkAuth} />;
  }

  return (
    <DashboardPage
      user={user}
      slackConnected={slackConnected}
      slackDetails={slackDetails}
      onLogout={handleLogout}
      onRefreshAuth={checkAuth}
    />
  );
};

export default App;
