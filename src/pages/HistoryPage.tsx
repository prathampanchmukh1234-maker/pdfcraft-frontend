import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Download, FileText, Calendar, Clock, ExternalLink, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoryItem {
  id: string;
  service_type: string;
  original_file_name: string;
  processed_file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

export default function HistoryPage({ session }: { session: Session }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHistory = async () => {
    if (!session?.user?.id) return;
    
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching history for user:", session.user.id);
      const response = await axios.get('/api/history', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const data = response.data || [];
      console.log("History fetched successfully:", data.length, "items");
      setHistory(data);
    } catch (err: any) {
      console.error('Error fetching history:', err);
      const message = err.response?.data?.error || err.message || 'Failed to fetch history.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      fetchHistory();
    }
    return () => { isMounted = false; };
  }, [session.user.id]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await axios.delete(`/api/history/${id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      setHistory(history.filter(item => item.id !== id));
    } catch (err: any) {
      console.error('Error deleting history:', err);
      const message = err.response?.data?.error || err.message || 'Failed to delete record';
      alert('Failed to delete record: ' + message);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = localUrl;
      link.download = filename || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(localUrl), 100);
    } catch (error) {
      console.error('Download error:', error);
      window.open(url, '_blank');
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredHistory = history.filter(item => {
    const matchesFilter = filter === 'all' || item.service_type === filter;
    const matchesSearch = item.original_file_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Documents</h1>
          <p className="text-slate-500 mt-1">Manage and download your previously processed files</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-sm"
            />
            <FileText className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto max-w-full">
            {['all', 'merge', 'split', 'sign', 'compress', 'edit'].map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize whitespace-nowrap",
                  filter === t ? "bg-red-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-3xl flex items-start gap-4 shadow-sm">
          <div className="bg-red-100 p-2 rounded-xl">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold">History Error</h3>
            <p className="text-sm opacity-90">{error}</p>
            <button 
              onClick={fetchHistory}
              className="mt-2 text-xs font-bold underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {filteredHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-bold text-slate-900 uppercase tracking-wider">Document</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-900 uppercase tracking-wider">Tool</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-900 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-900 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-sm font-bold text-slate-900 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHistory.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-lg">
                          <FileText className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 truncate max-w-[200px]" title={item.original_file_name}>
                            {item.original_file_name || 'Untitled Document'}
                          </span>
                          <span className="text-xs text-slate-400">PDF Document</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 capitalize">
                        {item.service_type.replace(/-/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                      {formatSize(item.file_size)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {new Date(item.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(item.file_url, item.original_file_name)}
                          className="p-2 bg-slate-100 hover:bg-red-600 hover:text-white text-slate-700 rounded-xl transition-all"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 rounded-xl transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center space-y-4">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">No documents found</h3>
              <p className="text-slate-500">Your processed files will appear here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
