import React from 'react';
import { LayoutDashboard, Calendar, Send, Plus } from 'lucide-react';

interface SidebarProps {
  activeTab: 'overview' | 'scheduled' | 'sent';
  setActiveTab: (tab: 'overview' | 'scheduled' | 'sent') => void;
  onOpenCompose: () => void;
  scheduledCount?: number;
  sentCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCompose,
  scheduledCount = 0,
  sentCount = 0,
}) => {
  return (
    <div className="bg-white border-b border-slate-200/80 shadow-sm sticky top-16 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto py-1 no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-600" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('scheduled')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'scheduled'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Scheduled Emails</span>
            {scheduledCount > 0 && (
              <span className="ml-1 text-[11px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                {scheduledCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'sent'
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
            }`}
          >
            <Send className="w-4 h-4 text-emerald-600" />
            <span>Sent Emails</span>
            {sentCount > 0 && (
              <span className="ml-1 text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                {sentCount}
              </span>
            )}
          </button>
        </nav>

        {/* Compose CTA Button on Right */}
        <div className="flex items-center space-x-2 ml-auto sm:ml-0">
          <button
            onClick={onOpenCompose}
            className="flex items-center space-x-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-indigo-200 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>Compose New Email</span>
          </button>
        </div>
      </div>
    </div>
  );
};

