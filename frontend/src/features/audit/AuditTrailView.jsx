import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { auditApi } from '../../utils/api';
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Shield,
  Eye,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const AuditTrailView = () => {
  const { showNotification } = useApp();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Diff Modal State
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await auditApi.getLogs({
        search: search.trim() || undefined,
        action: actionFilter || undefined,
        limit: 100
      });
      setLogs(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      showNotification('Failed to load audit trail', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search, actionFilter]);

  return (
    <div className="space-y-5 w-full">
      {/* 1. TOP BANNER */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2DEEC] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-[#1E182B] tracking-tight">
              Company Audit Trail
            </h1>
            <span className="bg-[#EFEBF8] text-[#6B46C1] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#D8BFD8]/50">
              {total} Logged Events
            </span>
          </div>
          <p className="text-xs text-[#584E6B] mt-1">
            Complete, immutable chronological log of tender claims, CRM changes, status updates, and user role modifications.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-[#E2DEEC] bg-[#FAF9FD] hover:bg-white text-xs font-semibold text-[#584E6B] cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* 2. FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-[#E2DEEC] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, tender ID, or action..."
            className="w-full bg-[#FAF9FD] border border-[#E2DEEC] text-xs rounded-lg pl-9 pr-3 py-2 outline-none focus:border-[#6B46C1] focus:bg-white text-[#1E182B] placeholder:text-[#8C82A0]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-[#584E6B]">Action:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-2.5 py-1.5 text-xs text-[#1E182B] outline-none focus:border-[#6B46C1] font-semibold"
          >
            <option value="">All Actions</option>
            <option value="CLAIM">CLAIM (Tender Picked)</option>
            <option value="CREATE">CREATE (Record Added)</option>
            <option value="UPDATE">UPDATE (Details/Remarks)</option>
            <option value="DELETE">DELETE (Record Removed)</option>
            <option value="ROLE_CHANGE">ROLE_CHANGE (User Provisioned)</option>
            <option value="PERMISSION_CHANGE">PERMISSION_CHANGE</option>
          </select>
        </div>
      </div>

      {/* 3. AUDIT LOGS TABLE */}
      <div className="bg-white rounded-xl border border-[#E2DEEC] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#6B46C1]" />
            <span className="text-xs text-[#584E6B] font-medium">Loading audit events...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Clock className="w-10 h-10 text-[#8C82A0] mx-auto opacity-40" />
            <h3 className="text-sm font-bold text-[#1E182B]">No Audit Records Found</h3>
            <p className="text-xs text-[#584E6B] max-w-sm mx-auto">
              Any actions performed by team members will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF9FD] border-b border-[#E2DEEC] text-[#584E6B] font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Target ID</th>
                  <th className="py-3 px-4">Summary</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DEEC]">
                {logs.map((log) => {
                  let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
                  if (log.action === 'CLAIM') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
                  if (log.action === 'CREATE') badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  if (log.action === 'UPDATE') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
                  if (log.action === 'DELETE') badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';

                  const dateFormatted = log.created_at
                    ? new Date(log.created_at).toLocaleString()
                    : 'Recent';

                  return (
                    <tr key={log.id} className="hover:bg-[#FAF9FD]/80 transition">
                      
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#584E6B] whitespace-nowrap">
                        {dateFormatted}
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-[#1E182B]">{log.user_name}</div>
                        <div className="text-[10px] text-[#8C82A0] uppercase font-semibold">
                          {log.user_role}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${badgeColor}`}>
                          {log.action}
                        </span>
                      </td>

                      {/* Entity Type */}
                      <td className="py-3.5 px-4 capitalize font-semibold text-[#1E182B]">
                        {log.entity_type}
                      </td>

                      {/* Entity ID */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#6B46C1] font-semibold max-w-[150px] truncate">
                        {log.entity_id}
                      </td>

                      {/* Changes summary */}
                      <td className="py-3.5 px-4 text-[#584E6B] max-w-[260px] truncate">
                        {log.new_values ? (
                          <span>
                            {Object.keys(log.new_values).map((k) => `${k}: ${log.new_values[k]}`).join(', ')}
                          </span>
                        ) : log.old_values ? (
                          <span className="text-rose-600">Deleted entry</span>
                        ) : (
                          <span className="text-[#8C82A0]">—</span>
                        )}
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#FAF9FD] hover:bg-[#EFEBF8] text-[#6B46C1] border border-[#E2DEEC] font-semibold text-[11px] transition cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect</span>
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. LOG INSPECT MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E2DEEC] relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DEEC]">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#6B46C1]" />
                <h3 className="text-sm font-bold text-[#1E182B]">
                  Audit Event #{selectedLog.id}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-[#8C82A0] hover:text-[#1E182B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#FAF9FD] p-3 rounded-xl border border-[#E2DEEC]">
                <div>
                  <span className="text-[#8C82A0] block">User</span>
                  <span className="font-bold text-[#1E182B]">{selectedLog.user_name} ({selectedLog.user_role})</span>
                </div>
                <div>
                  <span className="text-[#8C82A0] block">Timestamp</span>
                  <span className="font-medium text-[#1E182B]">{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[#8C82A0] block">Action</span>
                  <span className="font-bold text-[#6B46C1]">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[#8C82A0] block">Target</span>
                  <span className="font-medium text-[#1E182B]">{selectedLog.entity_type} ({selectedLog.entity_id})</span>
                </div>
              </div>

              {selectedLog.old_values && (
                <div>
                  <span className="font-bold text-rose-700 block mb-1">Previous Values:</span>
                  <pre className="bg-rose-50/70 border border-rose-200 text-rose-900 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_values && (
                <div>
                  <span className="font-bold text-emerald-700 block mb-1">New / Updated Values:</span>
                  <pre className="bg-emerald-50/70 border border-emerald-200 text-emerald-900 p-3 rounded-xl font-mono text-[11px] overflow-x-auto">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 flex justify-end border-t border-[#E2DEEC]">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-[#6B46C1] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

