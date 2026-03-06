import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { NAV_ITEMS, TOOLS } from '@/constants';
import { cn } from '@/lib/utils';
import { LogOut, Menu, X, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ToolPage from './pages/ToolPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <AppContent session={session} />
    </Router>
  );
}

function AppContent({ session }: { session: Session | null }) {
  const location = useLocation();
  const isSignTool = location.pathname.includes('/tool/sign');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar session={session} />
      <main className={cn(
        "pt-16 min-h-screen",
        isSignTool ? "px-0" : "pb-12 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto"
      )}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!session ? <Register /> : <Navigate to="/" />} />
          <Route path="/dashboard" element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} />
          <Route path="/history" element={session ? <HistoryPage session={session} /> : <Navigate to="/login" />} />
          <Route path="/tool/:toolId" element={<ToolPage session={session} />} />
        </Routes>
      </main>
    </div>
  );
}

function Navbar({ session }: { session: Session | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navLinks = [
    { name: 'MERGE PDF', path: '/tool/merge' },
    { name: 'SPLIT PDF', path: '/tool/split' },
    { name: 'COMPRESS PDF', path: '/tool/compress' },
    { name: 'HISTORY', path: '/history', private: true },
    { 
      name: 'CONVERT PDF', 
      path: '#', 
      hasDropdown: true,
      items: [
        { name: 'JPG to PDF', path: '/tool/jpg-to-pdf' },
        { name: 'WORD to PDF', path: '/tool/word-to-pdf' },
        { name: 'POWERPOINT to PDF', path: '/tool/ppt-to-pdf' },
        { name: 'EXCEL to PDF', path: '/tool/excel-to-pdf' },
        { name: 'HTML to PDF', path: '/tool/html-to-pdf' },
      ]
    },
    { 
      name: 'ALL PDF TOOLS', 
      path: '#', 
      hasDropdown: true,
      items: TOOLS.map(t => ({ name: t.name, path: t.path }))
    },
  ];

  const visibleNavLinks = navLinks.filter(link => !link.private || session);

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-50 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-1">
              <div className="flex items-center">
                <span className="text-2xl font-black tracking-tighter text-slate-900">Pdf</span>
                <span className="text-2xl font-black tracking-tighter text-[#e5322d]">Aura</span>
              </div>
            </Link>
            <div className="hidden lg:flex items-center space-x-1">
              {visibleNavLinks.map((item) => (
                <div key={item.name} className="relative group">
                  <Link
                    to={item.path}
                    className={cn(
                      "px-3 py-2 text-[13px] font-bold tracking-wide transition-colors flex items-center gap-1",
                      location.pathname === item.path
                        ? "text-red-600"
                        : "text-slate-700 hover:text-red-600"
                    )}
                  >
                    {item.name}
                    {item.hasDropdown && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </Link>
                  {item.hasDropdown && (
                    <div className="absolute left-0 top-full pt-2 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
                      <div className="bg-white border border-slate-200 rounded-lg shadow-xl py-2 min-w-[200px]">
                        {item.items?.map((subItem) => (
                          <Link
                            key={subItem.name}
                            to={subItem.path}
                            className="block px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 transition-colors"
                          >
                            {subItem.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-6">
            <div className="flex items-center gap-6">
              {session ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-slate-600">{session.user.email}</span>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-bold text-slate-700 hover:text-red-600 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-bold text-slate-700 hover:text-red-600 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2.5 text-sm font-bold text-white bg-[#e5322d] hover:bg-[#d42d28] rounded-md transition-all shadow-sm active:scale-95"
                  >
                    Sign up
                  </Link>
                </>
              )}
              <button className="p-2 text-slate-600 hover:text-slate-900">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-base font-medium",
                    location.pathname === item.path
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {item.name}
                </Link>
              ))}
              {!session ? (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => {
                    handleLogout();
                    setIsOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-slate-600 hover:bg-slate-50"
                >
                  Logout
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
