import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { TOOLS } from '@/constants';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, ArrowRight, User, Settings, Shield, Loader2 } from 'lucide-react';
import axios from 'axios';

export default function Dashboard({ session }: { session: Session }) {
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0, operations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get('/api/history', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const history = response.data;
        const totalSize = history.reduce((acc: number, item: any) => acc + (item.file_size || 0), 0);
        setStats({
          totalFiles: history.length,
          totalSize: totalSize,
          operations: history.length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [session.access_token]);

  const storageLimit = 100 * 1024 * 1024; // 100MB free limit
  const storageUsagePercent = Math.min(100, (stats.totalSize / storageLimit) * 100);

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <User className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-4">
            <div className="bg-red-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-500/20">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Welcome back!</h1>
              <p className="text-slate-500">{session.user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-4">
            <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-slate-700">Verified Account</span>
            </div>
            <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Free Plan</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {TOOLS.slice(0, 3).map((tool) => (
              <Link
                key={tool.id}
                to={tool.path}
                className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-red-200 hover:shadow-lg transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className={`${tool.color} w-10 h-10 rounded-xl flex items-center justify-center text-white`}>
                    <tool.icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-900">{tool.name}</span>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-colors" />
              </Link>
            ))}
            <Link to="/history" className="text-center py-2 text-sm font-bold text-red-600 hover:underline">
              View all tools & history
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Account Overview
          </h2>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Storage Usage</span>
                    <span className="font-medium text-slate-900">{storageUsagePercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-red-600 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${storageUsagePercent}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Files</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalFiles}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Operations</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.operations}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
