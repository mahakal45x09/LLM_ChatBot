import React from 'react';
import { Sparkles, Code2, Compass, MessageSquareQuote } from 'lucide-react';

const SUGGESTIONS = [
  {
    icon: Code2,
    title: 'Code assistance',
    desc: 'Write a Python FastAPI background task example',
  },
  {
    icon: Sparkles,
    title: 'Explain concepts',
    desc: 'Explain Server-Sent Events (SSE) vs WebSockets',
  },
  {
    icon: Compass,
    title: 'Brainstorm ideas',
    desc: 'Give me 5 project ideas integrating modern LLMs',
  },
  {
    icon: MessageSquareQuote,
    title: 'Debug and review',
    desc: 'Help me review and optimize this React component',
  },
];

export default function EmptyState({ onSelectSuggestion }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 shadow-lg shadow-indigo-500/5">
        <Sparkles className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-semibold text-slate-100">How can I help you today?</h2>
      <p className="text-sm text-slate-400 mt-1 mb-8">
        Ask questions, generate code, brainstorm ideas, or analyze text in real-time.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {SUGGESTIONS.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={() => onSelectSuggestion(item.desc)}
              className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900 transition-all group"
            >
              <div className="flex items-center space-x-2 text-indigo-400 mb-1">
                <Icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-slate-300">{item.title}</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">{item.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
