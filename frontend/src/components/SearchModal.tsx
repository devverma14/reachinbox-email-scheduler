import React, { useState, useEffect } from 'react';
import { X, Search, Clock, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { emailApi } from '../services/api';
import { SearchResult } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await emailApi.search(query);
        setResults(res);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-slate-50">
          <Search className="w-5 h-5 text-indigo-600 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email subject, content, or recipient via Elasticsearch..."
            className="w-full text-sm bg-transparent outline-none text-slate-900 placeholder-slate-400 font-medium"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-4 divide-y divide-slate-100">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Searching Elasticsearch index...</div>
          ) : results.length === 0 && query.trim() ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No matching records found for "{query}".
            </div>
          ) : !query.trim() ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Type to search subject, body, or email addresses across all indexed email records.
            </div>
          ) : (
            results.map((res) => {
              const isSent = res.status === 'SENT';
              const isFailed = res.status === 'FAILED';

              return (
                <div key={res.logId} className="py-3 px-2 hover:bg-slate-50 rounded-xl transition-colors space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {isSent ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isFailed ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-indigo-600" />
                      )}
                      <span className="text-xs font-bold text-slate-900">{res.recipientEmail}</span>
                    </div>

                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {res.status}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-800">{res.subject}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-2">{res.bodyText}</p>

                  {res.etherealPreviewUrl && (
                    <a
                      href={res.etherealPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-[11px] font-semibold text-indigo-600 hover:underline pt-1"
                    >
                      <span>Preview Email</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Powered by Elasticsearch</span>
          <span>Press ESC to exit</span>
        </div>

      </div>
    </div>
  );
};
