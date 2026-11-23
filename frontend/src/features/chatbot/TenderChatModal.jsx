import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [hasParsed, setHasParsed] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [activeTender, setActiveTender] = useState(tender);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const tenderId = activeTender?.tender_id || activeTender?.reference || 'Tender';
  const isParsed = Boolean(
    hasParsed ||
    (activeTender?.extracted_pdf_text && activeTender.extracted_pdf_text.length > 30) ||
    (activeTender?.scope_summary && activeTender.scope_summary.length > 20 && !activeTender.scope_summary.toLowerCase().includes('could not retrieve'))
  );

  // Sync activeTender when tender prop changes
  useEffect(() => {
    setActiveTender(tender);
    setHasParsed(false);
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
      const updatedTender = res.data;
      setActiveTender(updatedTender);
      setHasParsed(true);
      if (onTenderParsed) onTenderParsed(updatedTender);
      if (refreshStats) refreshStats();
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: updatedTender }));
      showNotification('PDF Document parsed successfully! Full clauses loaded into AI context.', 'success');

      const parsedWelcomeText = 
        `👋 Hello! I am your **Tender AI Assistant** locked specifically to **Tender \`${tenderId}\`**.\n\n` +
        `✅ **Document Parsed:** Full PDF text layer and ATC clauses are loaded.\n\n` +
        `You can ask me about:\n` +
        `* 💰 **EMD, ePBG & Bank Guarantee amounts**\n` +
        `* 📈 **Bidder & OEM Turnover requirements**\n` +
        `* 📦 **BOQ Equipment & Hardware Specifications**\n` +
        `* 🏷️ **MSE / Startup Relaxation Exemptions**\n` +
        `* ⚖️ **STQC, BIS CRS & Mandatory Compliances**\n` +
        `* ⏳ **Critical Deadlines & Delivery Periods**`;

      setMessages((prev) => {
        // Replace initial unparsed warning message so the parse message is no longer present!
        const updated = [...prev];
        if (updated.length > 0 && updated[0].role === 'assistant' && updated[0].content.includes('not been parsed yet')) {
          updated[0] = {
            role: 'assistant',
            content: parsedWelcomeText,
            sources: ['Verified Tender PDF & Data'],
            confidence: 'High',
            suggested_followups: [
              'What are the EMD and Turnover requirements?',
              'What equipment is in the BOQ scope?',
              'Are MSE or Startups exempt in this tender?'
            ]
          };
          return [
            ...updated,
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
          ];
        }

        return [
          ...updated,
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
        ];
      });
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
            <code key={cIdx} className="px-1.5 py-0.5 bg-[#FAF5FF] border border-[#E9D8FD] text-[#6B46C1] rounded text-[11px] font-mono font-semibold break-all">
              {chunk.slice(1, -1)}
            </code>
          );
        }
        return chunk;
      });

      return <p key={lIdx} className="my-0.5 text-xs leading-relaxed break-words">{renderedLine}</p>;
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-[#141021]/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full h-[100dvh] sm:h-[88vh] sm:max-h-[760px] max-w-2xl bg-white rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-[#E2DEEC] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-150 ring-1 ring-purple-950/5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Header */}
        <div className="bg-white px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-[#E2DEEC] flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-tr from-[#553C9A] to-[#6B46C1] text-white flex items-center justify-center shadow-md shadow-purple-900/20 shrink-0">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h3 className="font-bold text-[#1E182B] text-xs sm:text-sm truncate">
                  Tender AI<span className="hidden xs:inline sm:inline"> Chat</span>
                </h3>
                {isParsed ? (
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#2E7D32] bg-[#E8F5E9] border border-[#C8D8C4] px-1.5 py-0.5 sm:px-2 rounded-full font-mono flex items-center space-x-1 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="xs:hidden">Parsed</span>
                    <span className="hidden xs:inline">Document Parsed</span>
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-bold text-[#9A3412] bg-[#FFF2E5] border border-[#FFDAB9] px-1.5 py-0.5 sm:px-2 rounded-full font-mono flex items-center space-x-1 shrink-0">
                    <span className="xs:hidden">Unparsed</span>
                    <span className="hidden xs:inline">Unparsed PDF</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] font-mono text-[#8C82A0] truncate">
                Locked: <span className="text-[#6B46C1] font-semibold">{tenderId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetChat}
              className="p-1.5 text-slate-400 hover:text-[#6B46C1] hover:bg-[#FAF5FF] active:bg-[#E9D8FD] rounded-lg transition cursor-pointer touch-manipulation"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition flex items-center justify-center cursor-pointer touch-manipulation"
              title="Close chat (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Unparsed PDF Alert Banner (if not parsed yet) */}
        {!isParsed && (
          <div className="bg-[#FFF8F0] border-b border-[#FFE4C4] px-3.5 py-2.5 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-[#D97706] shrink-0" />
              <p className="text-[11px] sm:text-xs text-[#92400E] leading-snug">
                Parse bid PDF to unlock full BOQ, STQC/BIS rules & financial clauses.
              </p>
            </div>
            <button
              type="button"
              disabled={parsing}
              onClick={handleParseNow}
              className="w-full sm:w-auto shrink-0 px-3 py-1.5 sm:py-1 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center space-x-1.5 shadow-2xs transition cursor-pointer touch-manipulation"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{parsing ? 'Parsing...' : 'Parse PDF Now'}</span>
            </button>
          </div>
        )}

        {/* 3. Chat Message Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-4 bg-[#FAF9FD]">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5 animate-in fade-in duration-150`}
            >
              {m.role === 'user' ? (
                <div className="bg-[#6B46C1] text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl rounded-br-xs max-w-[88%] sm:max-w-[85%] text-xs shadow-xs font-medium leading-relaxed break-words">
                  {m.content}
                </div>
              ) : (
                <div className="bg-white border border-[#E2DEEC] rounded-2xl rounded-bl-xs p-3 sm:p-4 max-w-[96%] sm:max-w-[90%] text-xs shadow-xs text-[#1E182B] space-y-2.5 relative group break-words">
                  <div>{renderFormattedContent(m.content)}</div>

                  {/* Sources Badge & Copy Action */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="pt-2 border-t border-[#F0EDF7] flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-[#8C82A0]">
                      <div className="flex flex-wrap items-center gap-1 min-w-0">
                        <span className="font-semibold text-[#584E6B] flex items-center space-x-1 shrink-0">
                          <FileText className="w-3 h-3 text-[#6B46C1]" />
                          <span>Sources:</span>
                        </span>
                        {m.sources.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            className="bg-[#FAF5FF] text-[#6B46C1] border border-[#E9D8FD] px-1.5 py-0.2 rounded font-mono truncate max-w-[130px] sm:max-w-none"
                          >
                            {s}
                          </span>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopy(m.content, idx)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition inline-flex items-center space-x-1 text-[#6B46C1] hover:underline cursor-pointer py-1 px-1.5 rounded active:bg-purple-50 touch-manipulation"
                        title="Copy answer"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="font-medium">Copy</span>
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
                          className="text-[11px] text-[#4A337A] bg-[#FAF5FF] hover:bg-[#E9D8FD] active:bg-[#D8BFD8] border border-[#D8BFD8] px-2.5 py-1 rounded-lg font-medium transition cursor-pointer text-left break-words max-w-full touch-manipulation"
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
                <Sparkles className="w-4 h-4 animate-spin text-[#6B46C1] shrink-0" />
                <span className="font-semibold text-[11px] sm:text-xs">Searching tender clauses & analyzing requirements...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 4. Suggested Prompt Chips */}
        {messages.length <= 2 && suggested.length > 0 && !loading && (
          <div className="px-3 sm:px-4 py-2 border-t border-[#F0EDF7] bg-white overflow-hidden">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold text-[#8C82A0] uppercase tracking-wider shrink-0 flex items-center space-x-1">
                <HelpCircle className="w-3 h-3 text-[#6B46C1]" />
                <span className="hidden xs:inline">Quick Ask:</span>
              </span>
              <div className="flex items-center space-x-1.5 overflow-x-auto touch-pan-x no-scrollbar py-0.5">
                {suggested.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="shrink-0 text-[11px] text-[#4A337A] bg-[#FAF9FD] hover:bg-[#E6E6FA] active:bg-[#E9D8FD] border border-[#E2DEEC] hover:border-[#D8BFD8] px-2.5 py-1 rounded-full transition cursor-pointer font-medium whitespace-nowrap touch-manipulation"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 5. Chat Input Box */}
        <div className="p-2.5 sm:p-3.5 bg-white border-t border-[#E2DEEC] shrink-0 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
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
              placeholder="Ask about clauses, BOQ, EMD, Turnover..."
              disabled={loading}
              className="w-full pl-3.5 pr-11 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#6B46C1] focus:border-transparent text-xs text-[#1E182B] disabled:bg-slate-50 transition shadow-2xs"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] disabled:opacity-40 text-white flex items-center justify-center transition shadow-xs cursor-pointer touch-manipulation"
              title="Send question"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          <div className="flex items-center justify-between mt-1 px-1 text-[10px] text-slate-400">
            <span className="truncate">Answers generated from tender official documents</span>
            <span className="hidden sm:inline shrink-0 ml-2">Press Enter to send</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TenderChatModal;
