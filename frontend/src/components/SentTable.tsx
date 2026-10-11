import React, { useState } from 'react';
import { Send, CheckCircle2, XCircle, ExternalLink, RefreshCw, Eye } from 'lucide-react';
import { SentEmail } from '../types';

interface SentTableProps {
  emails: SentEmail[];
  loading: boolean;
  onRefresh: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({ emails, loading, onRefresh }) => {
  const [selectedError, setSelectedError] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-2">
          <Send className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900">Sent & Delivered Log</h3>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Refresh Sent Log</span>
        </button>
      </div>

      {/* Data Table */}
      {loading && emails.length === 0 ? (
        <div className="p-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : emails.length === 0 ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Send className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900">No sent emails recorded yet</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Emails dispatched by the BullMQ worker will appear here with live Nodemailer Ethereal preview links.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                <th className="py-3 px-6">Recipient</th>
                <th className="py-3 px-6">Subject</th>
                <th className="py-3 px-6">Sent Time</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Ethereal Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {emails.map((email) => {
                const isSent = email.status === 'SENT' || email.status === 'COMPLETED';

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
                      {new Date(email.sentAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 whitespace-nowrap">
                      {isSent ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Delivered</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => setSelectedError(email.lastError || 'Email send failed')}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Failed (View error)</span>
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      {email.etherealPreviewUrl ? (
                        <a
                          href={email.etherealPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview Email</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px]">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Error Details Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-rose-600 flex items-center space-x-2">
              <XCircle className="w-5 h-5" />
              <span>Email Delivery Failure Log</span>
            </h4>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 break-words">
              {selectedError}
            </div>
            <button
              onClick={() => setSelectedError(null)}
              className="w-full py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
