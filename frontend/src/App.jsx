import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import EmptyState from './components/EmptyState';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState('');
  const [botName, setBotName] = useState('Nova');
  const [conversationId, setConversationId] = useState(null);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch backend status and persona info
  useEffect(() => {
    fetch(`${API_BASE_URL}/`)
      .then((res) => res.json())
      .then((data) => {
        if (data.model) {
          setModelInfo(`${data.provider}: ${data.model}`);
        }
        if (data.bot_name) {
          setBotName(data.bot_name);
        }
      })
      .catch(() => {
        setModelInfo('Backend offline');
      });
  }, []);

  const stopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const sendMessage = async (userText) => {
    if (!userText.trim() || isLoading) return;

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setIsLoading(true);

    // Placeholder for assistant message
    const assistantIndex = newMessages.length;
    setMessages([...newMessages, { role: 'assistant', content: '', botName }]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.filter((m) => !m.isError),
          conversation_id: conversationId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status} (${response.statusText})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);

          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);

            if (parsed.conversation_id && !conversationId) {
              setConversationId(parsed.conversation_id);
            }

            if (parsed.content) {
              assistantText += parsed.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[assistantIndex] = {
                  role: 'assistant',
                  content: assistantText,
                  botName,
                };
                return updated;
              });
            } else if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[assistantIndex] = {
                  role: 'assistant',
                  content: parsed.error,
                  isError: true,
                };
                return updated;
              });
            }
          } catch {
            // Ignore malformed json chunks
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          updated[assistantIndex] = {
            role: 'assistant',
            content: `Communication error: ${err.message}. Please check that the FastAPI server is running.`,
            isError: true,
          };
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const retryLastMessage = () => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      // Remove any trailing error assistant message
      setMessages((prev) => prev.filter((_, idx) => idx !== prev.length - 1));
      sendMessage(lastUserMessage.content);
    }
  };

  const clearChat = async () => {
    stopStream();
    if (conversationId) {
      try {
        await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
          method: 'DELETE',
        });
      } catch {
        // Ignore backend reset error
      }
    }
    setConversationId(null);
    setMessages([]);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
      <Header
        onClearChat={clearChat}
        messageCount={messages.length}
        modelInfo={modelInfo}
        botName={botName}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 flex flex-col justify-between py-6">
        <div className="flex-1 space-y-4 mb-4">
          {messages.length === 0 ? (
            <EmptyState onSelectSuggestion={sendMessage} />
          ) : (
            messages.map((msg, index) => (
              <ChatMessage
                key={index}
                message={msg}
                isStreaming={
                  isLoading &&
                  index === messages.length - 1 &&
                  msg.role === 'assistant' &&
                  !msg.isError
                }
                onRetry={msg.isError ? retryLastMessage : undefined}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="sticky bottom-4 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
          <ChatInput
            onSendMessage={sendMessage}
            isLoading={isLoading}
            onStopStream={stopStream}
          />
          <p className="text-center text-[11px] text-slate-500 mt-2">
            {botName} is an AI Assistant. Multi-turn session active with automated context window management.
          </p>
        </div>
      </main>
    </div>
  );
}
