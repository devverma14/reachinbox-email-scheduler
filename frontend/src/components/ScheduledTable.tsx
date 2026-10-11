import React from 'react';
import { Calendar, Trash2, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { ScheduledEmail } from '../types';
import { formatKolkataDisplay } from '../utils/timezone';

interface ScheduledTableProps {
  emails: ScheduledEmail[];
  loading: boolean;
  onCancelEmail: (logId: string) => void;
  onRefresh: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  loading,
  onCancelEmail,
  onRefresh,
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Table Header Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-bold text-slate-900">Scheduled Email Queue</h3>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Loading Skeleton / Empty State / Data Table */}
      {loading && emails.length === 0 ? (
        <div className="p-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : emails.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">No scheduled emails in queue</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click "Compose New Email" to schedule campaign emails with custom rate limits and delayed execution.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                <th className="py-3 px-6">Recipient</th>
                <th className="py-3 px-6">Subject</th>
                <th className="py-3 px-6">Scheduled Time</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {emails.map((email) => {
                const isRescheduled = email.status === 'RESCHEDULED';
                const isProcessing = email.status === 'PROCESSING';

                return (
                  <tr key={email.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-slate-900">
                      {email.recipientEmail}
                      <div className="text-[11px] text-slate-400 font-normal">From: {email.senderEmail}</div>
                    </td>
                    <td className="py-3.5 px-6 font-medium text-slate-800 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 whitespace-nowrap">
                      {formatKolkataDisplay(email.scheduledAt)}
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      {isProcessing ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Processing</span>
                        </span>
                      ) : isRescheduled ? (
                        <span
                          title={email.lastError || 'Rate limit reached'}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300"
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>Rescheduled (Rate Limit)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Clock className="w-3 h-3" />
                          <span>Scheduled</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => onCancelEmail(email.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Cancel Scheduled Job"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
