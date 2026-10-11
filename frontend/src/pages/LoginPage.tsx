import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, CheckCircle2, Layers, Search, ArrowRight, AlertTriangle } from 'lucide-react';
import { authApi } from '../services/api';
import { openGoogleOAuthPopup } from '../utils/oauthPopup';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check for query parameters passed on redirect (e.g. auth_error)
    const urlParams = new URLSearchParams(window.location.search);
    const authError = urlParams.get('auth_error');
    if (authError) {
      setErrorMsg(authError);
      // Clean up URL query parameters from browser history immediately
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleGoogleLogin = () => {
    setErrorMsg('');
    openGoogleOAuthPopup({
      onSuccess: () => {
        onLoginSuccess();
      },
      onError: (err) => {
        setErrorMsg(err);
      },
      onLoading: (isLoading) => {
        setAuthLoading(isLoading);
      },
    });
  };

  const handleDevLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      await authApi.devLogin('demo.user@reachinbox.ai', 'Demo Executive');
      onLoginSuccess();
    } catch (err: any) {
      console.error('Dev login error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to initialize demo session.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Subtle Lavender / Blue Accent Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-100/60 via-purple-100/30 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl pointer-events-none" />

      {/* Navbar Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md shadow-indigo-200">
            R
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">ReachInbox</span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-500">
              Email Scheduling & Dispatch
            </span>
          </div>
        </div>
      </header>

      {/* Main Hero & Auth Container */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start relative z-10 my-auto">
        
        {/* Left Column: Branding Value Proposition & Feature Grid */}
        <div className="lg:col-span-7 space-y-6 text-left">
          
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
            Schedule smarter.{' '}
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
              Reach every inbox
            </span>{' '}
            at the right time.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
            Plan your emails, control sending speed, and let background jobs handle scheduled delivery.
          </p>

          {/* Grid of Key Product Features (2x2 Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            
            {/* Card 1 */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5 hover:border-indigo-200 transition-colors">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">Scheduled Sending Delays</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Control the interval between emails and schedule campaigns for a chosen time using BullMQ delayed jobs.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5 hover:border-emerald-200 transition-colors">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">Rate Limit Protection</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Use Redis-backed hourly limits to control sending speed and reschedule jobs when limits are reached.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5 hover:border-purple-200 transition-colors">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">Persistent Background Processing</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Process queued emails independently of the web interface, with persistence and recovery supported by the existing implementation.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-1.5 hover:border-amber-200 transition-colors">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900">Queue Monitoring & Search</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Inspect background job states and search indexed email records through Elasticsearch.
              </p>
            </div>

          </div>

        </div>

        {/* Right Column: Authentication Card */}
        <div className="lg:col-span-5 w-full max-w-md mx-auto">
          <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-5 relative">
            <div className="space-y-1.5 text-center">
              <h3 className="text-xl font-extrabold text-slate-900">Access ReachInbox</h3>
              <p className="text-xs text-slate-500">
                Sign in with Google or explore the scheduling workflow in an isolated demo workspace.
              </p>
            </div>

            {/* Error Message Banner */}
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3.5 pt-1">
              {/* Google OAuth Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={authLoading || loading}
                className="w-full flex items-center justify-center space-x-3 py-3 px-4 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 shadow-xs transition-all group disabled:opacity-50"
              >
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{authLoading ? 'Authenticating in Popup...' : 'Continue with Google'}</span>
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-white px-3 text-slate-400 font-bold">OR TRY THE DEMO</span>
                </div>
              </div>

              {/* Quick Demo Login CTA */}
              <button
                onClick={handleDevLogin}
                disabled={loading || authLoading}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-200 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <span>{loading ? 'Opening Demo Workspace...' : 'Try Demo Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Recruiter / Reviewer Info */}
            <div className="pt-3.5 border-t border-slate-100 text-[11px] text-slate-500 space-y-1 text-center">
              <p className="flex items-center justify-center space-x-1 font-semibold text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Isolated Workspace Pre-Configured</span>
              </p>
              <p className="text-slate-500 leading-relaxed">
                Demo access creates an isolated workspace so you can explore scheduling, background processing, and email previews without connecting a Google account.
              </p>
            </div>

          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
        <div>
          ReachInbox Email Scheduler • Engineered with Node.js, Express, BullMQ, Redis, PostgreSQL & React
        </div>
        <div className="flex items-center space-x-4">
          <span>IST Timezone (Asia/Kolkata)</span>
          <span>•</span>
          <span>Ethereal SMTP Integration</span>
        </div>
      </footer>

    </div>
  );
};

