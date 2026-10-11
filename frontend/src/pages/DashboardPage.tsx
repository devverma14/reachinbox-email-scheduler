import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { ScheduledTable } from '../components/ScheduledTable';
import { SentTable } from '../components/SentTable';
import { ComposeModal } from '../components/ComposeModal';
import { SlackModal } from '../components/SlackModal';
import { SearchModal } from '../components/SearchModal';
import { emailApi, authApi } from '../services/api';
import { User, SlackDetails, ScheduledEmail, SentEmail, EmailStats } from '../types';
import { Calendar, Send, AlertTriangle, Gauge, Plus, RefreshCw, Cpu } from 'lucide-react';

interface DashboardPageProps {
  user: User;
  slackConnected: boolean;
  slackDetails: SlackDetails | null;
  onLogout: () => void;
  onRefreshAuth: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  slackConnected,
  slackDetails,
  onLogout,
  onRefreshAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'scheduled' | 'sent'>('overview');
  
  const [stats, setStats] = useState<EmailStats>({
    scheduled: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    total: 0,
    currentHourlyRate: 0,
  });

  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackModalOpen, setIsSlackModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Fetch Dashboard Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, scheduledRes, sentRes] = await Promise.all([
        emailApi.getStats(),
        emailApi.getScheduled(1, 20),
        emailApi.getSent(1, 20),
      ]);

      setStats(statsRes);
      setScheduledEmails(scheduledRes.data);
      setSentEmails(sentRes.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh stats every 8 seconds
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Cancel scheduled email
  const handleCancelScheduled = async (logId: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled email job?')) return;
    try {
      await emailApi.cancelScheduled(logId);
      fetchData();
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        user={user}
        slackConnected={slackConnected}
        slackDetails={slackDetails}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSlackModal={() => setIsSlackModalOpen(true)}
        onLogout={onLogout}
        onRefreshAuth={onRefreshAuth}
      />

      {/* Horizontal Sub-Navigation Row */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCompose={() => setIsComposeOpen(true)}
        scheduledCount={stats.scheduled}
        sentCount={stats.sent}
      />

      {/* Main Dashboard Workspace */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'overview' && 'Campaign Overview'}
              {activeTab === 'scheduled' && 'Scheduled Email Queue'}
              {activeTab === 'sent' && 'Sent & Delivered Logs'}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage cold outreach scheduling, delayed queues, and Slack rate limit protection
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchData}
              className="flex items-center space-x-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors text-xs font-semibold"
              title="Sync Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Sync Stats</span>
            </button>
          </div>
        </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Scheduled Queue */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Queue</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.scheduled}</h3>
                <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                  +{stats.processing} processing in BullMQ
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
            </div>

            {/* Card 2: Total Sent */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Delivered Emails</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.sent}</h3>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">Ethereal SMTP active</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Send className="w-6 h-6" />
              </div>
            </div>

            {/* Card 3: Sending Rate Limit */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hourly Dispatch Rate</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.currentHourlyRate}</h3>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">Atomic Redis window</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Gauge className="w-6 h-6" />
              </div>
            </div>

            {/* Card 4: Failed / Alert Count */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Failed / Rescheduled</p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.failed}</h3>
                <p className="text-[11px] text-rose-600 font-semibold mt-1">Slack alerts enabled</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

          </div>

          {/* Main Tab Views */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <ScheduledTable
                emails={scheduledEmails}
                loading={loading}
                onCancelEmail={handleCancelScheduled}
                onRefresh={fetchData}
              />
              <SentTable emails={sentEmails} loading={loading} onRefresh={fetchData} />
            </div>
          )}

          {activeTab === 'scheduled' && (
            <ScheduledTable
              emails={scheduledEmails}
              loading={loading}
              onCancelEmail={handleCancelScheduled}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'sent' && (
            <SentTable emails={sentEmails} loading={loading} onRefresh={fetchData} />
          )}

        </main>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={fetchData}
        userEmail={user.email}
      />

      <SlackModal
        isOpen={isSlackModalOpen}
        onClose={() => setIsSlackModalOpen(false)}
        slackConnected={slackConnected}
        slackDetails={slackDetails}
        onStatusChange={onRefreshAuth}
      />

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
};
