import React, { useState, useRef, useEffect } from 'react';
import { SendHorizontal, StopCircle } from 'lucide-react';

export default function ChatInput({ onSendMessage, isLoading, onStopStream }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (isLoading) {
      onStopStream?.();
      return;
    }
    if (!input.trim()) return;

    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="relative flex items-end rounded-2xl bg-slate-900 border border-slate-800 shadow-xl focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for newline)"
          rows={1}
          className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none max-h-44"
        />

        <div className="p-2 shrink-0">
          {isLoading ? (
            <button
              type="button"
              onClick={onStopStream}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-colors"
              title="Stop generating"
            >
              <StopCircle className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-all shadow-md shadow-indigo-600/30 disabled:shadow-none"
              title="Send message"
            >
              <SendHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
