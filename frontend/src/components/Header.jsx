import React from 'react';
import { Bot, Trash2, ShieldCheck } from 'lucide-react';

export default function Header({ onClearChat, messageCount, modelInfo, botName }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-semibold text-lg text-slate-100 tracking-tight">
                {botName || 'Nova'}
              </h1>
              <span className="px-2 py-0.5 text-xs rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
                AI Architect
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                {modelInfo || 'Connecting...'}
              </span>
            </div>
            <p className="text-xs text-slate-400">Technical advisor with multi-turn memory & context management</p>
          </div>
        </div>

        {messageCount > 0 && (
          <button
            onClick={onClearChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
            title="Reset conversation and start fresh"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">New Session</span>
          </button>
        )}
      </div>
    </header>
  );
}
