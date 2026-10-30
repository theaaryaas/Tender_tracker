import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { tenderApi } from '../../utils/api';
import { Clock, ArrowRight, Eye, Star, AlertCircle } from 'lucide-react';

const COLUMNS = [
  { id: 'New', title: 'New Opportunities', color: 'border-slate-300' },
  { id: 'Reviewing', title: 'Under BD Review', color: 'border-amber-400' },
  { id: 'Bid Ready', title: 'Bid Decided (Go)', color: 'border-emerald-500' },
  { id: 'Submitted', title: 'Bid Submitted', color: 'border-blue-500' },
  { id: 'Won', title: 'Awarded / Won', color: 'border-purple-500' },
];

export const KanbanView = () => {
  const { openTenderDrawer, showNotification, refreshStats } = useApp();
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchKanbanTenders = async () => {
    setLoading(true);
    try {
      const res = await tenderApi.getTenders({ limit: 100 });
      setTenders(res.data.items || []);
    } catch (e) {
      console.error(e);
      showNotification('Failed to load Kanban board', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKanbanTenders();
  }, []);

  // Real-time synchronization when tender is updated from drawer
  useEffect(() => {
    const handleUpdate = (e) => {
      const updated = e.detail;
      if (updated?.id) {
        setTenders((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        );
      }
    };
    window.addEventListener('tender:updated', handleUpdate);
    return () => window.removeEventListener('tender:updated', handleUpdate);
  }, []);

  const moveTender = async (e, tenderId, nextStatus) => {
    e.stopPropagation();
    try {
      const res = await tenderApi.updateTender(tenderId, { status: nextStatus });
      setTenders((prev) =>
        prev.map((t) => (t.id === tenderId ? { ...t, status: nextStatus } : t))
      );
      window.dispatchEvent(new CustomEvent('tender:updated', { detail: res.data }));
      if (refreshStats) {
        refreshStats();
      }
      showNotification(`Moved to ${nextStatus}`, 'success');
    } catch (e) {
      showNotification('Failed to update tender stage', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Opportunity Pipeline Board</h2>
          <p className="text-xs text-slate-500">Track and advance bids through business development stages</p>
        </div>
        <button
          onClick={fetchKanbanTenders}
          className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
        >
          Refresh Board
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto min-h-[600px] pb-4">
        {COLUMNS.map((col, idx) => {
          const colTenders = tenders.filter((t) => (t.status || 'New') === col.id);
          const nextCol = COLUMNS[idx + 1]?.id;

          return (
            <div key={col.id} className="bg-slate-100/70 rounded-xl p-3 flex flex-col space-y-3 border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-bold text-xs text-slate-800">{col.title}</span>
                <span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-700">
                  {colTenders.length}
                </span>
              </div>

              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-16rem)]">
                {colTenders.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => openTenderDrawer(t)}
                    className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200/60">
                        {t.tender_id}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {t.fit_score}% Fit
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-700">
                      {t.title}
                    </h4>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-50">
                      <span className="truncate max-w-[100px]">{t.portal}</span>
                      <span className="text-[10px] font-medium text-slate-400">
                        {t.closing_date ? t.closing_date.split(' ')[0] : ''}
                      </span>
                    </div>

                    {nextCol && (
                      <button
                        onClick={(e) => moveTender(e, t.id, nextCol)}
                        className="w-full mt-1.5 py-1 px-2 rounded bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] font-medium transition flex items-center justify-center space-x-1 border border-slate-200"
                      >
                        <span>Advance to {nextCol}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}

                {colTenders.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400 italic">
                    No tenders in this stage.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

