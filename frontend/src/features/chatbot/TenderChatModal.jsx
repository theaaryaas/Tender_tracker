import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  X,
  RotateCcw,
  Copy,
  Check,
  FileText,
  HelpCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { chatbotApi, tenderApi } from '../../utils/api';
import { useApp } from '../../context/AppContext';

export const TenderChatModal = ({ isOpen, onClose, tender, onTenderParsed }) => {
  const { showNotification, refreshStats } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [activeTender, setActiveTender] = useState(tender);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const tenderId = activeTender?.tender_id || activeTender?.reference || 'Tender';
  const isParsed = Boolean(activeTender?.extracted_pdf_text && activeTender.extracted_pdf_text.length > 50);

  // Sync activeTender when tender prop changes
  useEffect(() => {
    setActiveTender(tender);
  }, [tender]);

  // Handle Escape key to close ONLY the chat modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // Load initial suggestions and welcome message when opened
  useEffect(() => {
    if (!isOpen) return;

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

    const welcomeText = isParsed
      ? `👋 Hello! I am your **Tender AI Assistant** locked specifically to **Tender \`${tenderId}\`**.\n\n` +
        `✅ **Document Parsed:** Full PDF text layer and ATC clauses are loaded.\n\n` +
        `You can ask me about:\n` +
        `* 💰 **EMD, ePBG & Bank Guarantee amounts**\n` +
        `* 📈 **Bidder & OEM Turnover requirements**\n` +
        `* 📦 **BOQ Equipment & Hardware Specifications**\n` +
        `* 🏷️ **MSE / Startup Relaxation Exemptions**\n` +
        `* ⚖️ **STQC, BIS CRS & Mandatory Compliances**\n` +
        `* ⏳ **Critical Deadlines & Delivery Periods**`
      : `👋 Hello! I am your **Tender AI Assistant** for **Tender \`${tenderId}\`**.\n\n` +
        `⚠️ *Note: The official bid document PDF has not been parsed yet.* I can currently answer basic overview metadata.\n\n` +
        `👉 **Click the "⚡ Parse PDF Document Now" button above** to extract all multi-page clauses, BOQ specifications, and EMD/turnover criteria for deep analysis.`;

    setMessages([
      {
        role: 'assistant',
        content: welcomeText,
        sources: [isParsed ? 'Verified Tender PDF & Data' : 'Tender Basic Metadata'],
        confidence: isParsed ? 'High' : 'Basic',
        suggested_followups: [
          'What are the EMD and Turnover requirements?',
          'What is the equipment scope / BOQ?',
          'Are MSE or Startups exempt?'
        ]
      }
    ]);

    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, [isOpen, tenderId, isParsed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleParseNow = async () => {
    if (!activeTender?.id || parsing) return;
    setParsing(true);
    try {
      const res = await tenderApi.parseTenderPdf(activeTender.id);
      setActiveTender(res.data);
      if (onTenderParsed) onTenderParsed(res.data);
      if (refreshStats) refreshStats();
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: res.data }));
      showNotification('PDF Document parsed successfully! Full clauses loaded into AI context.', 'success');

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `🎉 **Document Successfully Parsed!**\n\nI have extracted all multi-page clauses, BOQ items, financial schedules, and compliance rules from the official PDF. All deep RAG questions are now fully unlocked!`,
          sources: ['Parsed Document Layer'],
          confidence: 'High',
          suggested_followups: [
            'What are the EMD and Turnover requirements?',
            'What equipment is in the BOQ scope?',
            'What are the STQC and BIS certifications required?'
          ]
        }
      ]);
    } catch (err) {
      showNotification('Failed to parse PDF document. Please check portal link.', 'error');
    } finally {
      setParsing(false);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-60 bg-[#141021]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl h-[88vh] max-h-[760px] bg-white rounded-2xl shadow-2xl border border-[#E2DEEC] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 ring-1 ring-purple-950/5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Header */}
        <div className="bg-white px-5 py-3.5 border-b border-[#E2DEEC] flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#553C9A] to-[#6B46C1] text-white flex items-center justify-center shadow-md shadow-purple-900/20 shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-[#1E182B] text-sm truncate">Tender Intelligence Chat</h3>
                {isParsed ? (
                  <span className="text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] border border-[#C8D8C4] px-2 py-0.2 rounded-full font-mono flex items-center space-x-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Document Parsed & Ready</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#9A3412] bg-[#FFF2E5] border border-[#FFDAB9] px-2 py-0.2 rounded-full font-mono flex items-center space-x-1 shrink-0">
                    <span>Unparsed PDF</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] font-mono text-[#8C82A0] truncate">
                Locked to: <span className="text-[#6B46C1] font-semibold">{tenderId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetChat}
              className="p-1.5 text-slate-400 hover:text-[#6B46C1] hover:bg-[#FAF5FF] rounded-lg transition cursor-pointer"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition flex items-center justify-center cursor-pointer"
              title="Close chat (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Unparsed PDF Alert Banner (if not parsed yet) */}
        {!isParsed && (
          <div className="bg-[#FFF8F0] border-b border-[#FFE4C4] px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
              <p className="text-xs text-[#92400E] truncate">
                Parse bid PDF to unlock full BOQ, STQC/BIS rules & financial clauses.
              </p>
            </div>
            <button
              type="button"
              disabled={parsing}
              onClick={handleParseNow}
              className="shrink-0 px-3 py-1 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center space-x-1.5 shadow-2xs transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{parsing ? 'Parsing...' : 'Parse PDF Now'}</span>
            </button>
          </div>
        )}

        {/* 3. Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#FAF9FD]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5 animate-in fade-in duration-150`}
            >
              {m.role === 'user' ? (
                <div className="bg-[#6B46C1] text-white px-4 py-2.5 rounded-2xl rounded-br-xs max-w-[85%] text-xs shadow-xs font-medium leading-relaxed">
                  {m.content}
                </div>
              ) : (
                <div className="bg-white border border-[#E2DEEC] rounded-2xl rounded-bl-xs p-4 max-w-[95%] sm:max-w-[90%] text-xs shadow-xs text-[#1E182B] space-y-2.5 relative group">
                  <div>{renderFormattedContent(m.content)}</div>

                  {/* Sources Badge */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="pt-2 border-t border-[#F0EDF7] flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#8C82A0]">
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
                <span className="font-semibold">Searching tender clauses & analyzing requirements...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 4. Suggested Prompt Chips */}
        {messages.length <= 2 && suggested.length > 0 && !loading && (
          <div className="px-4 py-2 border-t border-[#F0EDF7] bg-white overflow-x-auto">
            <div className="flex items-center space-x-1.5 pb-0.5">
              <span className="text-[10px] font-bold text-[#8C82A0] uppercase tracking-wider shrink-0 flex items-center space-x-1">
                <HelpCircle className="w-3 h-3 text-[#6B46C1]" />
                <span>Quick Ask:</span>
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

        {/* 5. Chat Input Box */}
        <div className="p-3.5 bg-white border-t border-[#E2DEEC] shrink-0">
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
              placeholder={`Ask any question about ${tenderId}...`}
              disabled={loading}
              className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-xs text-[#1E182B] disabled:bg-slate-50 transition shadow-2xs"
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
            <span>Answers generated from this tender's official documents</span>
            <span>Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenderChatModal;
