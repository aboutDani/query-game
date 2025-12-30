
import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white font-mono selection:bg-cyan-500 selection:text-black">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to={createPageUrl('Game')} className="text-xl font-bold tracking-tighter flex items-center gap-2">
            <div className="w-6 h-6 bg-white flex items-center justify-center">
              <div className="w-4 h-4 bg-black"></div>
            </div>
            QueRy
          </Link>
          <div className="text-xs text-neutral-500">
            SURVIVE THE CODE
          </div>
        </div>
      </header>
      
      <main className="pt-24 pb-12 px-0 md:px-6 min-h-screen flex flex-col items-center justify-center">
        {children}
      </main>

      <style>{`
        body {
          background-color: #0a0a0a;
          overflow: hidden; /* Prevent scrolling during game */
        }
      `}</style>
    </div>
  );
}
