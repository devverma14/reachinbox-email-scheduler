import React, { useState } from 'react';
import { X, Upload, CheckCircle2, AlertTriangle, Clock, Gauge, Send, FileText, UserCheck } from 'lucide-react';
import Papa from 'papaparse';
import { emailApi } from '../services/api';
import { formatInKolkataISO, parseKolkataLocalToISO, formatKolkataDisplay } from '../utils/timezone';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userEmail?: string;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userEmail = 'demo.user@reachinbox.ai',
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [senderEmail, setSenderEmail] = useState(userEmail);
  const [rawRecipientsText, setRawRecipientsText] = useState('');
  const [parsedRecipients, setParsedRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  
  // Date default to 2 mins in future (Asia/Kolkata IST)
  const defaultDate = formatInKolkataISO(new Date(Date.now() + 2 * 60 * 1000));
  const [scheduledAt, setScheduledAt] = useState(defaultDate);
  const [delayBetweenSendsSec, setDelayBetweenSendsSec] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  // Email regex validator
  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Parse text or CSV input
  const processRecipientsText = (text: string) => {
    setRawRecipientsText(text);
    const emails = text
      .split(/[\n,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => isValidEmail(e));
    // Unique list
    const uniqueEmails = Array.from(new Set(emails));
    setParsedRecipients(uniqueEmails);
  };

  // CSV File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    Papa.parse(file, {
      complete: (results) => {
        const extracted: string[] = [];
        results.data.forEach((row: any) => {
          if (typeof row === 'string') {
            if (isValidEmail(row)) extracted.push(row.trim());
          } else if (Array.isArray(row)) {
            row.forEach((col) => {
              if (typeof col === 'string' && isValidEmail(col)) extracted.push(col.trim());
            });
          } else if (typeof row === 'object' && row !== null) {
            Object.values(row).forEach((val) => {
              if (typeof val === 'string' && isValidEmail(val)) extracted.push(val.trim());
            });
          }
        });
        const unique = Array.from(new Set(extracted));
        setParsedRecipients(unique);
        setRawRecipientsText(unique.join('\n'));
      },
      error: (err) => {
        setErrorMsg(`Failed to parse CSV file: ${err.message}`);
      },
    });
  };

  const handleNextStep1 = () => {
    if (parsedRecipients.length === 0) {
      setErrorMsg('Please enter or upload at least one valid recipient email address.');
      return;
    }
    setErrorMsg('');
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (!subject.trim()) {
      setErrorMsg('Please enter an email subject.');
      return;
    }
    if (!bodyText.trim()) {
      setErrorMsg('Please enter the email body content.');
      return;
    }
    setErrorMsg('');
    setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      await emailApi.schedule({
        senderEmail,
        recipients: parsedRecipients,
        subject,
        bodyText,
        scheduledAt: parseKolkataLocalToISO(scheduledAt),
        delayBetweenSendsMs: delayBetweenSendsSec * 1000,
        hourlyLimit,
      });

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to schedule emails.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Schedule Email Campaign</h3>
            <p className="text-xs text-slate-500">Step {step} of 3 • ReachInbox Queue Engine</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-3 border-b border-slate-100 text-xs font-semibold">
          <div className={`py-2 px-4 text-center border-r ${step >= 1 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-400'}`}>
            1. Recipients
          </div>
          <div className={`py-2 px-4 text-center border-r ${step >= 2 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-400'}`}>
            2. Content
          </div>
          <div className={`py-2 px-4 text-center ${step >= 3 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-400'}`}>
            3. Schedule & Limits
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="p-6 space-y-5">
          
          {/* STEP 1: Recipients & Sender */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sender Email Address
                </label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="sender@reachinbox.ai"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recipients (CSV or Line-Separated)
                  </label>
                  {parsedRecipients.length > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center space-x-1">
                      <UserCheck className="w-3 h-3" />
                      <span>{parsedRecipients.length} valid lead(s) detected</span>
                    </span>
                  )}
                </div>

                {/* CSV File Upload Dropzone */}
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-indigo-400 bg-slate-50/50 transition-colors mb-3">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload-input"
                  />
                  <label htmlFor="csv-upload-input" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-6 h-6 text-indigo-500 mb-1" />
                    <span className="text-xs font-semibold text-slate-700">
                      {fileName ? `Uploaded: ${fileName}` : 'Upload CSV / TXT lead file'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">Click to browse or drop file here</span>
                  </label>
                </div>

                <textarea
                  rows={4}
                  value={rawRecipientsText}
                  onChange={(e) => processRecipientsText(e.target.value)}
                  placeholder="alex@outboxlabs.com&#10;sarah@enterprise.io&#10;michael@startup.co"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Subject & Body */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Introducing ReachInbox Scheduler — Scale your cold outreach"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Body Content (Text / HTML)
                </label>
                <textarea
                  rows={6}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Hi there,&#10;&#10;We are excited to share our latest product updates with you. Let us know if you would be open for a quick demo this week!&#10;&#10;Best regards,&#10;ReachInbox Team"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Schedule & Rate Limits */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Start Date & Time</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center space-x-1">
                    <Gauge className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Delay Between Sends (sec)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={delayBetweenSendsSec}
                    onChange={(e) => setDelayBetweenSendsSec(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Hourly Sending Limit (Per Sender)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                    className="w-32 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-bold"
                  />
                  <span className="text-xs text-slate-500">
                    emails / hour. Excess jobs will automatically delay into next hour window + fire Slack alert.
                  </span>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <h4 className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Scheduling Campaign Summary</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400">Total Leads:</span>{' '}
                    <strong className="text-slate-900">{parsedRecipients.length}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Sender:</span>{' '}
                    <strong className="text-slate-900 truncate">{senderEmail}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Start Time:</span>{' '}
                    <strong className="text-slate-900">{formatKolkataDisplay(parseKolkataLocalToISO(scheduledAt))}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Rate Limit:</span>{' '}
                    <strong className="text-slate-900">{hourlyLimit} emails/hr</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as any)}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={step === 1 ? handleNextStep1 : handleNextStep2}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-200 disabled:opacity-50"
            >
              {loading ? (
                <span>Scheduling Email Jobs...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Confirm & Schedule Jobs</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
