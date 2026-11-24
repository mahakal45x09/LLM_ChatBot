import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User, Copy, Check, AlertTriangle } from 'lucide-react';

export default function ChatMessage({ message, isStreaming, onRetry }) {
  const isUser = message.role === 'user';
  const isError = message.isError || message.role === 'error';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`py-4 px-4 sm:px-6 rounded-2xl transition-colors ${
      isUser 
        ? 'bg-slate-900/50 border border-slate-800 ml-auto max-w-[85%] sm:max-w-[75%]' 
        : isError
          ? 'bg-rose-950/20 border border-rose-800/40 shadow-sm max-w-full'
          : 'bg-slate-900/80 border border-slate-800 shadow-sm max-w-full'
    }`}>
      <div className="flex items-start space-x-3.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isUser 
            ? 'bg-indigo-600 text-white' 
            : isError
              ? 'bg-rose-600 text-white'
              : 'bg-violet-600 text-white'
        }`}>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : isError ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-medium ${isError ? 'text-rose-400' : 'text-slate-400'}`}>
              {isUser ? 'You' : isError ? 'System Notice' : (message.botName || 'Nova')}
            </span>
            {!isUser && !isError && message.content && (
              <button
                onClick={handleCopy}
                className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-800"
                title="Copy response"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          <div className="prose prose-invert prose-sm max-w-none break-words text-slate-200 leading-relaxed">
            {isError ? (
              <div className="text-rose-300 text-sm flex flex-col space-y-2">
                <p className="m-0 leading-normal">{message.content}</p>
                {onRetry && (
                  <div>
                    <button
                      onClick={onRetry}
                      className="inline-flex items-center text-xs px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-colors"
                    >
                      Retry request
                    </button>
                  </div>
                )}
              </div>
            ) : isUser ? (
              <p className="whitespace-pre-wrap m-0">{message.content}</p>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    return inline ? (
                      <code className="bg-slate-800 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 my-2 overflow-x-auto text-xs font-mono text-slate-300">
                        <code {...props}>{children}</code>
                      </pre>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
            {isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-violet-400 animate-pulse align-middle" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
