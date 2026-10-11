import React, { useState } from 'react';
import { Search, Slack, LogOut, User as UserIcon, CheckCircle2, AlertCircle, Link2 } from 'lucide-react';
import { User, SlackDetails } from '../types';
import { openGoogleOAuthPopup } from '../utils/oauthPopup';

interface NavbarProps {
  user: User | null;
  slackConnected: boolean;
  slackDetails: SlackDetails | null;
  onOpenSearch: () => void;
  onOpenSlackModal: () => void;
  onLogout: () => void;
  onRefreshAuth?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  slackConnected,
  slackDetails,
  onOpenSearch,
  onOpenSlackModal,
  onLogout,
  onRefreshAuth,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null);

  const isGoogleConnected = Boolean(user?.googleId);

  const handleConnectGoogle = () => {
    setGoogleConnectError(null);
    openGoogleOAuthPopup({
      onSuccess: () => {
        if (onRefreshAuth) onRefreshAuth();
      },
      onError: (errMsg) => {
        setGoogleConnectError(errMsg);
      },
      onLoading: (isLoading) => {
        setConnectingGoogle(isLoading);
      },
    });
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-indigo-200">
              R
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">ReachInbox</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-500">
                Email Scheduling & Dispatch
              </span>
            </div>
          </div>

          {/* Search Trigger */}
          <div className="flex-1 max-w-md mx-4">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3.5 py-2 text-sm text-slate-400 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-lg transition-all"
            >
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-slate-500" />
                <span>Search scheduled or sent emails...</span>
              </div>
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-3">
            
            {/* Google Account Connect Quick Button (If not linked yet) */}
            {user && !isGoogleConnected && (
              <button
                onClick={handleConnectGoogle}
                disabled={connectingGoogle}
                className="hidden md:flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-300 hover:border-indigo-300 transition-all shadow-sm disabled:opacity-50"
                title="Link your Google Account to preserve campaigns"
              >
                <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{connectingGoogle ? 'Connecting...' : 'Connect Google'}</span>
              </button>
            )}

            {/* Slack Connection Status Pill */}
            <button
              onClick={onOpenSlackModal}
              className={`flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                slackConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Slack className="w-3.5 h-3.5" />
              <span>{slackConnected ? `Slack: ${slackDetails?.channelName || 'Connected'}` : 'Connect Slack'}</span>
              {slackConnected ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3 h-3 text-amber-600" />
              )}
            </button>

            {/* User Dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none"
                >
                  {user.avatarUrl && !avatarError ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name || 'User'}
                      onError={() => setAvatarError(true)}
                      className="w-8 h-8 rounded-full border border-indigo-200 object-cover shadow-xs"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
                      {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden md:inline-block text-sm font-medium text-slate-700">
                    {user.name || user.email}
                  </span>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2.5 border-b border-slate-100">
                      <p className="text-sm font-semibold text-slate-900">{user.name || 'User Profile'}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1.5 flex items-center space-x-1">
                        {isGoogleConnected ? (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Google Account Linked
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Demo Workspace Session
                          </span>
                        )}
                      </div>
                    </div>

                    {googleConnectError && (
                      <div className="px-4 py-2 bg-rose-50 text-[11px] text-rose-600 border-b border-rose-100">
                        {googleConnectError}
                      </div>
                    )}

                    {!isGoogleConnected && (
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          handleConnectGoogle();
                        }}
                        disabled={connectingGoogle}
                        className="w-full flex items-center space-x-2 px-4 py-2.5 text-sm text-indigo-700 hover:bg-indigo-50 font-semibold text-left border-b border-slate-100"
                      >
                        <Link2 className="w-4 h-4 text-indigo-600" />
                        <span>{connectingGoogle ? 'Connecting Google...' : 'Connect Google Account'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        onOpenSlackModal();
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left"
                    >
                      <Slack className="w-4 h-4 text-slate-500" />
                      <span>Slack Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        onLogout();
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
