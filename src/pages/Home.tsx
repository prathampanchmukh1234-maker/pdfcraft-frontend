import React from 'react';
import { Link } from 'react-router-dom';
import { TOOLS } from '@/constants';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function Home() {
  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight"
        >
          Every tool you need to work with <span className="text-[#e5322d]">PDFs</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-slate-600 max-w-2xl mx-auto"
        >
          Every tool you need to use PDFs, at your fingertips. All are 100% FREE and easy to use! Merge, split, compress, convert, rotate and unlock PDFs with just a few clicks.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {TOOLS.map((tool, index) => (
          <motion.div
            key={tool.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
          >
            <Link
              to={tool.path}
              className="group block p-5 bg-white rounded-xl border border-slate-100 hover:border-red-50 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-200 h-full"
            >
              <div className="flex flex-col items-start gap-4">
                <div className={cn(
                  tool.color === 'bg-red-500' ? 'bg-[#e5322d]' : tool.color,
                  "w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform"
                )}>
                  <tool.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 group-hover:text-[#e5322d] transition-colors uppercase tracking-tight">
                    {tool.name}
                  </h3>
                  <p className="mt-1 text-slate-500 text-xs leading-tight font-medium">
                    {tool.description}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
