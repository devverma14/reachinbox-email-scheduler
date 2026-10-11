import React, { useState } from 'react';
import { X, Slack, CheckCircle2, AlertTriangle, Send, Link, Trash2 } from 'lucide-react';
import { authApi, slackApi } from '../services/api';
import { SlackDetails } from '../types';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackConnected: boolean;
  slackDetails: SlackDetails | null;
  onStatusChange: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackConnected,
  slackDetails,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleConnectLiveSlack = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const url = await authApi.getSlackAuthorizeUrl();
      window.location.href = url;
    } catch (err: any) {
      setLoading(false);
      setMsg({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Live Slack Client ID is not configured in .env. Use Quick Demo Connect below.',
      });
    }
  };

  const handleConnectMockSlack = async () => {
    setLoading(true);
    setMsg(null);
    try {
      await authApi.connectMockSlack('#email-notifications');
      setLoading(false);
      setMsg({ type: 'success', text: 'Slack workspace connected for demo mode!' });
      onStatusChange();
    } catch (err: any) {
      setLoading(false);
      setMsg({ type: 'error', text: err.message || 'Failed to connect Slack.' });
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await authApi.disconnectSlack();
      setLoading(false);
      setMsg({ type: 'success', text: 'Slack disconnected successfully.' });
      onStatusChange();
    } catch (err: any) {
      setLoading(false);
      setMsg({ type: 'error', text: 'Failed to disconnect.' });
    }
  };

  const handleSendTestNotification = async () => {
    setTestSending(true);
    setMsg(null);
    try {
      const res = await slackApi.sendTestNotification('demo.sender@reachinbox.ai');
      setTestSending(false);
      setMsg({ type: 'success', text: res.message || 'Test notification dispatched!' });
    } catch (err: any) {
      setTestSending(false);
      setMsg({
        type: 'error',
        text: err.response?.data?.message || err.message || 'Failed to dispatch test notification.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Slack className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Slack OAuth & Alert Integration</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          {/* Status Message */}
          {msg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-medium flex items-center space-x-2 ${
                msg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          {/* Connection Status Card */}
          {slackConnected ? (
            <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Slack Connected</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 px-2 py-0.5 bg-emerald-100 rounded-full">
                  Active
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <p>
                  <strong className="text-slate-900">Workspace:</strong> {slackDetails?.teamName || 'Connected Workspace'}
                </p>
                <p>
                  <strong className="text-slate-900">Alert Channel:</strong> {slackDetails?.channelName || '#email-notifications'}
                </p>
              </div>

              <div className="pt-2 flex items-center space-x-2">
                <button
                  onClick={handleSendTestNotification}
                  disabled={testSending}
                  className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testSending ? 'Sending...' : 'Test Rate-Limit Alert'}</span>
                </button>

                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="py-2 px-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl transition-colors flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect your Slack workspace to receive instant real-time alerts whenever a sender reaches their hourly sending limit and jobs are automatically rescheduled.
              </p>

              <div className="space-y-2">
                <button
                  onClick={handleConnectLiveSlack}
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center space-x-2"
                >
                  <Link className="w-4 h-4" />
                  <span>Connect Slack (OAuth Flow)</span>
                </button>

                <button
                  onClick={handleConnectMockSlack}
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center justify-center space-x-2"
                >
                  <Slack className="w-4 h-4 text-slate-600" />
                  <span>Quick Demo Connect (#email-notifications)</span>
                </button>
              </div>
            </div>
          )}

        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
