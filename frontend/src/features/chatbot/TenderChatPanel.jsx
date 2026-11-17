import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Bot,
  Send,
  Sparkles,
  X,
  RotateCcw,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  CornerDownLeft,
  HelpCircle
} from 'lucide-react';
import { chatbotApi } from '../../utils/api';

export const TenderChatPanel = ({ tender, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const tenderId = tender?.tender_id || tender?.reference || 'Tender';

  useEffect(() => {
    // Load initial suggested questions for this tender
    const loadSuggestions = async () => {
      try {
        const res = await chatbotApi.getSuggested(tenderId);
        if (res.data?.questions?.length > 0) {
          setSuggested(res.data.questions);
        } else {
          setSuggested([
            'What are the EMD and Turnover requirements?',
            'What equipment is in the BOQ scope?',
            'Are MSE or Startups exempt in this tender?',
            'What are the compliance and testing certifications required?'
          ]);
        }
      } catch (err) {
        setSuggested([
          'What are the EMD and Turnover requirements?',
          'What equipment is in the BOQ scope?',
          'Are MSE or Startups exempt in this tender?',
          'What are the compliance and testing certifications required?'
        ]);
      }
    };

    loadSuggestions();

    // Set welcome message
    setMessages([
      {
        role: 'assistant',
        content: `👋 Hello! I am your **Tender AI Assistant** locked specifically to **Tender \`${tenderId}\`**.\n\nYou can ask me anything about this tender's:\n* 💰 **EMD, ePBG & Turnover**\n* 📦 **BOQ Equipment & Hardware Scope**\n* 🏷️ **MSE & Startup Relaxations**\n* ⚖️ **STQC, BIS & ATC Compliance Clauses**\n* ⏳ **Critical Submission Deadlines**\n\nHow can I help you analyze this opportunity?`,
        sources: ['Tender Profile'],
        confidence: 'High',
        suggested_followups: [
          'What are the EMD and Turnover requirements?',
          'What is the equipment scope / BOQ?',
          'Are MSE or Startups exempt?'
        ]
      }
    ]);

    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 150);
  }, [tenderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText) => {
    const textToSend = (queryText !== undefined ? queryText : input).trim();
    if (!textToSend || loading) return;

    const userMessage = { role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await chatbotApi.query({
        tender_id: tenderId,
        query: textToSend,
        history: historyPayload
      });

      const assistantMessage = {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources || [],
        confidence: res.data.confidence || 'High',
        suggested_followups: res.data.suggested_followups || []
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Failed to retrieve answer from local tender RAG engine. Please try again.',
          sources: ['Error'],
          confidence: 'Error'
        }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Chat reset. What would you like to know about **Tender \`${tenderId}\`**?`,
        sources: ['Reset'],
        confidence: 'High',
        suggested_followups: [
          'What are the EMD and Turnover requirements?',
          'What is the equipment scope / BOQ?',
          'Are MSE or Startups exempt?'
        ]
      }
    ]);
  };

  // Helper to render bolding and bullet points cleanly in markdown
  const renderFormattedContent = (content) => {
    return content.split('\n').map((line, lIdx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={lIdx} className="font-bold text-[#1E182B] text-sm mt-2 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('* **') || line.startsWith('• **')) {
        const parts = line.replace(/^[*\-•]\s*/, '').split('**');
        return (
          <div key={lIdx} className="flex items-start space-x-1.5 my-1 ml-1 text-xs leading-relaxed">
            <span className="text-[#6B46C1] font-bold">•</span>
            <div>
              <span className="font-bold text-[#3B2961]">{parts[1]}</span>
              <span>{parts.slice(2).join('**')}</span>
            </div>
          </div>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote key={lIdx} className="border-l-2 border-[#6B46C1] pl-2.5 my-1.5 italic text-slate-600 bg-slate-50 py-1 rounded-r text-xs">
            {line.replace('> ', '')}
          </blockquote>
        );
      }
      if (line.trim() === '') {
        return <div key={lIdx} className="h-1.5" />;
      }

      // Inline bold renderer
      const renderedLine = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((chunk, cIdx) => {
        if (chunk.startsWith('**') && chunk.endsWith('**')) {
          return <strong key={cIdx} className="font-bold text-[#1E182B]">{chunk.slice(2, -2)}</strong>;
        }
        if (chunk.startsWith('`') && chunk.endsWith('`')) {
          return (
            <code key={cIdx} className="px-1.5 py-0.5 bg-[#FAF5FF] border border-[#E9D8FD] text-[#6B46C1] rounded text-[11px] font-mono font-semibold">
              {chunk.slice(1, -1)}
            </code>
          );
        }
        return chunk;
      });

      return <p key={lIdx} className="my-0.5 text-xs leading-relaxed">{renderedLine}</p>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF9FD] rounded-xl border border-[#E2DEEC] overflow-hidden shadow-xs">
      {/* 1. Chat Header */}
      <div className="bg-white px-4 py-3 border-b border-[#E2DEEC] flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#6B46C1] text-white flex items-center justify-center shadow-xs shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-[#1E182B] text-xs truncate">Tender Intelligence Chat</h3>
              <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] border border-[#C8D8C4] px-1.5 py-0.2 rounded-full font-mono flex items-center space-x-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Local RAG</span>
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#8C82A0] truncate">
              Grounded exclusively on {tenderId}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={handleResetChat}
            className="p-1.5 text-slate-400 hover:text-[#6B46C1] hover:bg-[#FAF5FF] rounded-lg transition cursor-pointer"
            title="Reset conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Close chat panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Chat Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5 animate-in fade-in duration-150`}
          >
            {m.role === 'user' ? (
              <div className="bg-[#6B46C1] text-white px-3.5 py-2.5 rounded-2xl rounded-br-xs max-w-[85%] text-xs shadow-xs font-medium leading-relaxed">
                {m.content}
              </div>
            ) : (
              <div className="bg-white border border-[#E2DEEC] rounded-2xl rounded-bl-xs p-3.5 max-w-[95%] sm:max-w-[88%] text-xs shadow-xs text-[#1E182B] space-y-2 relative group">
                <div>{renderFormattedContent(m.content)}</div>

                {/* Sources & Metadata Badge */}
                {m.sources && m.sources.length > 0 && (
                  <div className="pt-2 border-t border-[#F0EDF7] flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-[#8C82A0]">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold text-[#584E6B] flex items-center space-x-1">
                        <FileText className="w-3 h-3 text-[#6B46C1]" />
                        <span>Sources:</span>
                      </span>
                      {m.sources.map((s, sIdx) => (
                        <span
                          key={sIdx}
                          className="bg-[#FAF5FF] text-[#6B46C1] border border-[#E9D8FD] px-1.5 py-0.2 rounded font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(m.content, idx)}
                      className="opacity-0 group-hover:opacity-100 transition inline-flex items-center space-x-1 text-[#6B46C1] hover:underline cursor-pointer"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Suggested Follow-up chips for latest assistant message */}
                {idx === messages.length - 1 && m.suggested_followups && m.suggested_followups.length > 0 && !loading && (
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {m.suggested_followups.map((fQ, fIdx) => (
                      <button
                        key={fIdx}
                        type="button"
                        onClick={() => handleSend(fQ)}
                        className="text-[11px] text-[#4A337A] bg-[#FAF5FF] hover:bg-[#E9D8FD] border border-[#D8BFD8] px-2 py-1 rounded-lg font-medium transition cursor-pointer text-left"
                      >
                        💡 {fQ}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start space-x-2">
            <div className="bg-white border border-[#E2DEEC] rounded-2xl rounded-bl-xs p-3 shadow-xs inline-flex items-center space-x-2 text-xs text-[#6B46C1]">
              <Sparkles className="w-4 h-4 animate-spin text-[#6B46C1]" />
              <span className="font-semibold">Retrieving relevant tender clauses & BOQ specs...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Suggested Prompt Chips (if few messages) */}
      {messages.length <= 2 && suggested.length > 0 && !loading && (
        <div className="px-4 py-2 border-t border-[#F0EDF7] bg-white/70 overflow-x-auto">
          <div className="flex items-center space-x-1.5 pb-1">
            <span className="text-[10px] font-bold text-[#8C82A0] uppercase tracking-wider shrink-0 flex items-center space-x-1">
              <HelpCircle className="w-3 h-3 text-[#6B46C1]" />
              <span>Suggested:</span>
            </span>
            <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
              {suggested.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="shrink-0 text-[11px] text-[#4A337A] bg-[#FAF9FD] hover:bg-[#E6E6FA] border border-[#E2DEEC] hover:border-[#D8BFD8] px-2.5 py-1 rounded-full transition cursor-pointer font-medium"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. Chat Input Box */}
      <div className="p-3 bg-white border-t border-[#E2DEEC] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask anything about ${tenderId}...`}
            disabled={loading}
            className="w-full pl-3.5 pr-12 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-xs text-[#1E182B] disabled:bg-slate-50 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] disabled:opacity-40 text-white flex items-center justify-center transition shadow-xs cursor-pointer"
            title="Send question (Enter)"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
          <span>Grounded in this tender's PDF & metadata only</span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};

export default TenderChatPanel;
