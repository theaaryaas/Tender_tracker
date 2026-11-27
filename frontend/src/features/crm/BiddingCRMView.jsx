import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { crmApi } from '../../utils/api';
import { formatIndianDateTime } from '../../utils/dateUtils';
import {
  Users,
  Search,
  Plus,
  Flame,
  Snowflake,
  Phone,
  Mail,
  Building2,
  Calendar,
  Eye,
  Lock,
  Globe,
  Edit2,
  Trash2,
  FileText,
  ExternalLink,
  RefreshCw,
  X,
  CheckCircle2,
  Kanban,
  MessageSquare,
  Upload,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  UserCheck
} from 'lucide-react';

const PIPELINE_STAGE_OPTIONS = [
  {
    value: 'New',
    label: 'New Opportunities',
    shortLabel: 'New Opportunities',
    pillClass: 'bg-[#F3EFF8] text-[#6B46C1] border-[#D8BFD8] hover:bg-[#EAE3F6]',
  },
  {
    value: 'Reviewing',
    label: 'Under BD Review',
    shortLabel: 'Under BD Review',
    pillClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  {
    value: 'Bid Ready',
    label: 'Bid Decided (Go)',
    shortLabel: 'Bid Decided (Go)',
    pillClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
  },
  {
    value: 'Submitted',
    label: 'Bid Submitted',
    shortLabel: 'Bid Submitted',
    pillClass: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100',
  },
  {
    value: 'Won',
    label: 'Awarded / Won',
    shortLabel: 'Awarded / Won',
    pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
  },
  {
    value: 'Rejected',
    label: 'Rejected',
    shortLabel: 'Rejected',
    pillClass: 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200',
  },
];

const normalizePipelineStage = (stage) => {
  if (!stage) return 'New';
  if (stage === 'Under Review') return 'Reviewing';
  return stage;
};

export const BiddingCRMView = () => {
  const { user, isSuperAdmin, isManager, showNotification, openTenderDrawer, refreshStats } = useApp();
  const canDeleteRecords = isSuperAdmin || (user?.permissions || []).includes('can_delete_tenders');

  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [leadStatusFilter, setLeadStatusFilter] = useState(''); // '' | 'Warm' | 'Cold'
  const [pipelineFilter, setPipelineFilter] = useState(''); // '' | stage
  const [myRecordsOnly, setMyRecordsOnly] = useState(false);

  // Modal State for Manual Entry / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    client_name: '',
    client_designation: '',
    client_phone: '',
    client_email: '',
    remarks: '',
    lead_status: 'Warm',
    pipeline_stage: 'New',
    visibility: 'all'
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Remarks Quick-Edit Modal
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState(false);
  const [remarksRecord, setRemarksRecord] = useState(null);
  const [remarksText, setRemarksText] = useState('');

  // Bulk Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState(null);

  // Multi-select & Bulk Delete State
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectAllCheckboxRef = useRef(null);

  const canEditRecord = (rec) =>
    isSuperAdmin || isManager || rec.user_id === user?.id;

  const canDeleteRecord = (rec) =>
    canDeleteRecords && (isSuperAdmin || isManager || rec.user_id === user?.id);

  const deletableRecords = records.filter(canDeleteRecord);
  const allDeletableSelected =
    deletableRecords.length > 0 && deletableRecords.every((r) => selectedIds.includes(r.id));
  const someDeletableSelected =
    deletableRecords.some((r) => selectedIds.includes(r.id)) && !allDeletableSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someDeletableSelected;
    }
  }, [someDeletableSelected]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await crmApi.getRecords({
        search: search.trim() || undefined,
        lead_status: leadStatusFilter || undefined,
        pipeline_stage: pipelineFilter || undefined,
        my_records: myRecordsOnly,
        limit: 100
      });
      const items = res.data.items || [];
      setRecords(items);
      setTotal(res.data.total || 0);
      setSelectedIds((prev) => prev.filter((id) => items.some((r) => r.id === id)));
    } catch (err) {
      showNotification('Failed to load CRM records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [search, leadStatusFilter, pipelineFilter, myRecordsOnly]);

  // Keep linked CRM records synced when a tender's pipeline stage changes in TenderDrawer
  useEffect(() => {
    const handleTenderUpdated = (e) => {
      const updated = e.detail;
      if (!updated?.id || !updated?.status) return;
      const normalized = normalizePipelineStage(updated.status);
      setRecords((prev) =>
        prev.map((r) =>
          r.tender_id === updated.id
            ? {
                ...r,
                pipeline_stage: normalized,
                tender: r.tender ? { ...r.tender, status: updated.status } : r.tender
              }
            : r
        )
      );
    };
    window.addEventListener('tender:updated', handleTenderUpdated);
    return () => window.removeEventListener('tender:updated', handleTenderUpdated);
  }, []);

  // 1-Click Cycle Status (Hot -> Warm -> Cold -> Hot)
  const handleToggleStatus = async (record) => {
    let nextStatus = 'Warm';
    if (record.lead_status === 'Hot') nextStatus = 'Warm';
    else if (record.lead_status === 'Warm') nextStatus = 'Cold';
    else if (record.lead_status === 'Cold') nextStatus = 'Hot';

    try {
      const res = await crmApi.updateRecord(record.id, { lead_status: nextStatus });
      const updated = res.data;
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, ...updated, lead_status: nextStatus } : r))
      );
      showNotification(`Record updated to ${nextStatus}`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to update status', 'error');
    }
  };

  const handleChangePipelineStage = async (record, nextStage) => {
    try {
      const res = await crmApi.updateRecord(record.id, { pipeline_stage: nextStage });
      const updated = res.data;
      const stageLabel =
        PIPELINE_STAGE_OPTIONS.find((opt) => opt.value === nextStage)?.label || nextStage;
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, ...updated } : r))
      );
      if (record.tender_id) {
        window.dispatchEvent(
          new CustomEvent('tender:updated', { detail: { id: record.tender_id, status: nextStage } })
        );
        if (refreshStats) refreshStats();
      }
      showNotification(`Bid Pipeline moved to ${stageLabel}`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to update Bid Pipeline stage', 'error');
    }
  };

  // Handle Bulk Import
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showNotification('Please choose an Excel or CSV file to upload', 'error');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('file', selectedFile);

    setIsImporting(true);
    setImportFeedback(null);
    try {
      const res = await crmApi.importRecords(uploadData);
      setImportFeedback({
        type: 'success',
        message: res.data.message || `Successfully imported ${res.data.total_imported} records.`
      });
      showNotification(`Imported ${res.data.total_imported} leads with visibility 'all'`, 'success');
      fetchRecords();
      setTimeout(() => {
        setIsImportModalOpen(false);
        setSelectedFile(null);
        setImportFeedback(null);
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to import file. Please check format.';
      setImportFeedback({ type: 'error', message: msg });
      showNotification(msg, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormData({
      company_name: '',
      client_name: '',
      client_designation: '',
      client_phone: '',
      client_email: '',
      remarks: '',
      lead_status: 'Warm',
      pipeline_stage: 'New',
      visibility: 'all'
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (rec) => {
    setEditingRecord(rec);
    setFormData({
      company_name: rec.company_name,
      client_name: rec.client_name || '',
      client_designation: rec.client_designation || '',
      client_phone: rec.client_phone || '',
      client_email: rec.client_email || '',
      remarks: rec.remarks || '',
      lead_status: rec.lead_status || 'Warm',
      pipeline_stage: normalizePipelineStage(rec.pipeline_stage || rec.tender?.status || 'New'),
      visibility: rec.visibility || 'all'
    });
    setIsModalOpen(true);
  };

  // Submit Modal
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.company_name.trim()) {
      showNotification('Company name is required', 'error');
      return;
    }

    setModalSubmitting(true);
    try {
      if (editingRecord) {
        await crmApi.updateRecord(editingRecord.id, formData);
        if (editingRecord.tender_id && formData.pipeline_stage) {
          window.dispatchEvent(
            new CustomEvent('tender:updated', {
              detail: { id: editingRecord.tender_id, status: formData.pipeline_stage }
            })
          );
          if (refreshStats) refreshStats();
        }
        showNotification('CRM record updated successfully', 'success');
      } else {
        await crmApi.createManual(formData);
        showNotification('New CRM record created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchRecords();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Error saving CRM record', 'error');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Save Quick Remarks
  const handleSaveRemarks = async () => {
    if (!remarksRecord) return;
    try {
      const res = await crmApi.updateRecord(remarksRecord.id, { remarks: remarksText });
      const updated = res.data;
      setRecords((prev) =>
        prev.map((r) => (r.id === remarksRecord.id ? { ...r, ...updated, remarks: remarksText } : r))
      );
      showNotification('Remarks updated', 'success');
      setIsRemarksModalOpen(false);
    } catch (err) {
      showNotification('Failed to update remarks', 'error');
    }
  };

  // Delete Record
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this CRM record?')) return;
    const rec = records.find((r) => r.id === id);
    try {
      await crmApi.deleteRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
      if (rec?.tender_id) {
        window.dispatchEvent(
          new CustomEvent('tender:updated', {
            detail: { id: rec.tender_id, is_claimed: false, assigned_to: null, status: 'New' }
          })
        );
      }
      showNotification('CRM record deleted and tender released', 'info');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to delete record', 'error');
    }
  };

  // Toggle single row selection
  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  // Select / Untick all deletable rows
  const handleToggleSelectAll = () => {
    if (allDeletableSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(deletableRecords.map((r) => r.id));
    }
  };

  // Bulk Delete Selected Records
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || bulkDeleting) return;
    const count = selectedIds.length;
    if (!window.confirm(`Are you sure you want to delete ${count} selected CRM record(s)?`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const res = await crmApi.bulkDeleteRecords(selectedIds);
      const deletedSet = new Set(res.data?.deleted_ids || selectedIds);
      const releasedTenderIds = res.data?.released_tender_ids || [];

      setRecords((prev) => prev.filter((r) => !deletedSet.has(r.id)));
      setTotal((prev) => Math.max(0, prev - deletedSet.size));
      setSelectedIds([]);

      releasedTenderIds.forEach((tenderId) => {
        window.dispatchEvent(
          new CustomEvent('tender:updated', {
            detail: { id: tenderId, is_claimed: false, assigned_to: null, status: 'New' }
          })
        );
      });

      showNotification(`Deleted ${deletedSet.size} CRM record(s)`, 'info');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to delete selected records', 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-5 w-full">

      {/* 1. TOP HEADER BANNER */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2DEEC] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-[#1E182B] tracking-tight">
              Bidding CRM & Outreach
            </h1>
            <span className="bg-[#EFEBF8] text-[#6B46C1] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#D8BFD8]/50">
              {total} Active Engagements
            </span>
          </div>
          <p className="text-xs text-[#584E6B] mt-1">
            Track customer communications, pre-bid meetings, client nodal officers, and bid interest levels.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSelectedFile(null);
              setImportFeedback(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center justify-center space-x-1.5 bg-white hover:bg-[#FAF9FD] text-[#6B46C1] border border-[#D8BFD8] text-xs sm:text-sm font-semibold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Leads</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center space-x-2 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-purple-900/10 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Record</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-xl border border-[#E2DEEC] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C82A0] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, client, remarks, or tender ID..."
            className="w-full bg-[#FAF9FD] border border-[#E2DEEC] text-xs rounded-lg pl-9 pr-3 py-2 outline-none focus:border-[#6B46C1] focus:bg-white text-[#1E182B] placeholder:text-[#8C82A0]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex bg-[#FAF9FD] p-1 border border-[#E2DEEC] rounded-lg text-xs font-semibold">
            <button
              onClick={() => setLeadStatusFilter('')}
              className={`px-3 py-1 rounded-md transition ${!leadStatusFilter ? 'bg-white shadow-xs text-[#6B46C1]' : 'text-[#584E6B]'}`}
            >
              All Status
            </button>
            <button
              onClick={() => setLeadStatusFilter('Hot')}
              className={`px-2.5 py-1 rounded-md transition flex items-center space-x-1 ${leadStatusFilter === 'Hot' ? 'bg-[#FFF0F0] text-[#DC2626] font-bold shadow-xs' : 'text-[#584E6B]'}`}
            >
              <Flame className="w-3.5 h-3.5 text-[#DC2626]" />
              <span>Hot</span>
            </button>
            <button
              onClick={() => setLeadStatusFilter('Warm')}
              className={`px-2.5 py-1 rounded-md transition flex items-center space-x-1 ${leadStatusFilter === 'Warm' ? 'bg-[#FFF2E5] text-[#EA580C] font-bold shadow-xs' : 'text-[#584E6B]'}`}
            >
              <Flame className="w-3.5 h-3.5 text-[#EA580C]" />
              <span>Warm</span>
            </button>
            <button
              onClick={() => setLeadStatusFilter('Cold')}
              className={`px-2.5 py-1 rounded-md transition flex items-center space-x-1 ${leadStatusFilter === 'Cold' ? 'bg-[#EDF8FD] text-[#0284C7] font-bold shadow-xs' : 'text-[#584E6B]'}`}
            >
              <Snowflake className="w-3.5 h-3.5 text-[#0284C7]" />
              <span>Cold</span>
            </button>
          </div>

          {/* Bid Pipeline Filter */}
          <select
            value={pipelineFilter}
            onChange={(e) => setPipelineFilter(e.target.value)}
            aria-label="Filter by Bid Pipeline stage"
            className="bg-[#FAF9FD] border border-[#E2DEEC] text-xs font-semibold text-[#584E6B] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#6B46C1] focus:bg-white cursor-pointer"
          >
            <option value="">All Pipeline Stages</option>
            {PIPELINE_STAGE_OPTIONS.map((stage) => (
              <option key={stage.value} value={stage.value}>
                {stage.label}
              </option>
            ))}
          </select>

          {/* My Records Toggle */}
          <button
            onClick={() => setMyRecordsOnly(!myRecordsOnly)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${myRecordsOnly ? 'bg-[#6B46C1] text-white border-[#6B46C1]' : 'bg-[#FAF9FD] text-[#584E6B] border-[#E2DEEC] hover:bg-white'}`}
          >
            My Bids Only
          </button>
        </div>
      </div>

      {/* 3. DATA TABLE */}
      <div className="bg-white rounded-xl border border-[#E2DEEC] shadow-xs overflow-hidden">
        {canDeleteRecords && selectedIds.length > 0 && (
          <div className="px-4 py-2.5 bg-rose-50/90 border-b border-rose-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-3 text-xs">
              <span className="font-bold text-rose-900">
                {selectedIds.length} record{selectedIds.length === 1 ? '' : 's'} selected
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-rose-700 hover:text-rose-900 underline font-semibold cursor-pointer"
              >
                Untick all
              </button>
            </div>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          </div>
        )}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#6B46C1]" />
            <span className="text-xs text-[#584E6B] font-medium">Loading bidding records...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Building2 className="w-10 h-10 text-[#8C82A0] mx-auto opacity-40" />
            <h3 className="text-sm font-bold text-[#1E182B]">No Bidding CRM Records Found</h3>
            <p className="text-xs text-[#584E6B] max-w-sm mx-auto">
              Start by clicking "Pick Tender" from the master tender list or manually add an engagement lead above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF9FD] border-b border-[#E2DEEC] text-[#584E6B] font-bold uppercase text-[10px] tracking-wider">
                  {canDeleteRecords && (
                    <th className="py-3 pl-4 pr-2 w-10">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={allDeletableSelected}
                        disabled={deletableRecords.length === 0}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all records"
                        title={allDeletableSelected ? 'Untick all records' : 'Select all records'}
                        className="w-4 h-4 rounded border-[#D8BFD8] text-[#6B46C1] focus:ring-[#6B46C1] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Date Entered</th>
                  <th className="py-3 px-4">Status (1-Click)</th>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Client Contact</th>
                  <th className="py-3 px-4">Phone & Email</th>
                  <th className="py-3 px-4">Remarks / Discussion</th>
                  <th className="py-3 px-4 whitespace-nowrap">Bid Pipeline</th>
                  <th className="py-3 px-4">Visibility</th>
                  <th className="py-3 px-4 whitespace-nowrap">Last Changed By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DEEC]">
                {records.map((rec) => {
                  const isHot = rec.lead_status === 'Hot';
                  const isCold = rec.lead_status === 'Cold';
                  const isWarm = !isHot && !isCold;
                  const rowEditable = canEditRecord(rec);
                  const rowDeletable = canDeleteRecord(rec);
                  const isSelected = selectedIds.includes(rec.id);
                  const currentPipelineStage = normalizePipelineStage(
                    rec.pipeline_stage || rec.tender?.status || 'New'
                  );
                  const pipelineMeta =
                    PIPELINE_STAGE_OPTIONS.find((opt) => opt.value === currentPipelineStage) ||
                    PIPELINE_STAGE_OPTIONS[0];
                  return (
                    <tr
                      key={rec.id}
                      className={`transition ${isSelected ? 'bg-rose-50/50 hover:bg-rose-50/70' : 'hover:bg-[#FAF9FD]/80'}`}
                    >
                      {canDeleteRecords && (
                        <td className="py-3.5 pl-4 pr-2 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!rowDeletable}
                            onChange={() => handleToggleRow(rec.id)}
                            aria-label={`Select ${rec.company_name}`}
                            title={
                              rowDeletable
                                ? isSelected
                                  ? 'Untick record'
                                  : 'Tick record for delete'
                                : 'You can only delete records you created'
                            }
                            className="w-4 h-4 rounded border-[#D8BFD8] text-[#6B46C1] focus:ring-[#6B46C1] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                      )}

                      {/* Date Entered */}
                      <td className="py-3.5 px-4 font-semibold text-[#1E182B] whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#8C82A0]" />
                          <span>{rec.entered_date || 'N/A'}</span>
                        </div>
                        {rec.user_name && (
                          <span className="text-[10px] text-[#8C82A0] block mt-0.5">
                            By: {rec.user_name}
                          </span>
                        )}
                      </td>

                      {/* Status 1-Click Cycle (Hot -> Warm -> Cold) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(rec)}
                          title="Click to cycle status: Hot -> Warm -> Cold"
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full font-bold text-[11px] transition cursor-pointer shadow-xs border ${isHot
                              ? 'bg-[#FFF0F0] text-[#DC2626] border-[#FECACA] hover:bg-[#FFE2E2]'
                              : isCold
                                ? 'bg-[#EDF8FD] text-[#0284C7] border-[#BAE6FD] hover:bg-[#E0F2FE]'
                                : 'bg-[#FFF2E5] text-[#EA580C] border-[#FED7AA] hover:bg-[#FFE4D0]'
                            }`}
                        >
                          {isHot ? (
                            <>
                              <Flame className="w-3 h-3 text-[#DC2626]" />
                              <span>Hot</span>
                            </>
                          ) : isCold ? (
                            <>
                              <Snowflake className="w-3 h-3 text-[#0284C7]" />
                              <span>Cold</span>
                            </>
                          ) : (
                            <>
                              <Flame className="w-3 h-3 text-[#EA580C]" />
                              <span>Warm</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Company Name & Linked Tender */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="font-bold text-[#1E182B] truncate" title={rec.company_name}>
                          {rec.company_name}
                        </div>
                        {rec.tender ? (
                          <button
                            onClick={() => openTenderDrawer(rec.tender)}
                            className="inline-flex items-center space-x-1 text-[11px] text-[#6B46C1] hover:underline mt-0.5 cursor-pointer"
                          >
                            <span>{rec.tender.tender_id}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#8C82A0]">Off-portal bid</span>
                        )}
                      </td>

                      {/* Client Name & Designation */}
                      <td className="py-3.5 px-4 max-w-[180px]">
                        <div className="font-semibold text-[#1E182B] truncate">
                          {rec.client_name || <span className="text-[#8C82A0] italic">Not entered</span>}
                        </div>
                        <div className="text-[10px] text-[#584E6B] truncate">
                          {rec.client_designation || <span className="text-[#8C82A0] italic">—</span>}
                        </div>
                      </td>

                      {/* Phone & Email */}
                      <td className="py-3.5 px-4 whitespace-nowrap space-y-1">
                        {rec.client_phone ? (
                          <a
                            href={`tel:${rec.client_phone}`}
                            className="flex items-center space-x-1.5 text-blue-700 hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{rec.client_phone}</span>
                          </a>
                        ) : (
                          <span className="text-[#8C82A0] text-[10px] italic">No phone</span>
                        )}

                        {rec.client_email ? (
                          <a
                            href={`mailto:${rec.client_email}`}
                            className="flex items-center space-x-1.5 text-purple-700 hover:underline"
                          >
                            <Mail className="w-3 h-3" />
                            <span className="max-w-[130px] truncate">{rec.client_email}</span>
                          </a>
                        ) : null}
                      </td>

                      {/* Remarks (Conversation notes) */}
                      <td className="py-3.5 px-4 max-w-[240px]">
                        <div
                          onClick={() => {
                            setRemarksRecord(rec);
                            setRemarksText(rec.remarks || '');
                            setIsRemarksModalOpen(true);
                          }}
                          className="cursor-pointer group flex items-start space-x-1"
                          title="Click to view or edit remarks"
                        >
                          <p className="line-clamp-2 text-[#584E6B] group-hover:text-[#1E182B] leading-relaxed">
                            {rec.remarks || <span className="text-[#8C82A0] italic">Click to add remarks...</span>}
                          </p>
                          <Edit2 className="w-3 h-3 text-[#8C82A0] opacity-0 group-hover:opacity-100 transition shrink-0 mt-0.5" />
                        </div>
                      </td>

                      {/* Bid Pipeline Stage */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start space-y-0.5">
                          <div className="inline-flex items-center space-x-1.5">
                            <Kanban className="w-3.5 h-3.5 text-[#6B46C1] shrink-0" />
                            <select
                              value={currentPipelineStage}
                              disabled={!rowEditable}
                              onChange={(e) => handleChangePipelineStage(rec, e.target.value)}
                              aria-label={`Bid Pipeline stage for ${rec.company_name}`}
                              className={`px-2 py-1 rounded-full text-[11px] font-bold border outline-none transition ${pipelineMeta.pillClass} ${
                                rowEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                              }`}
                            >
                              {PIPELINE_STAGE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {rec.tender && (
                            <span className="text-[9.5px] text-[#8C82A0] pl-5">
                              Synced with pipeline
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Visibility Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${rec.visibility === 'me'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : rec.visibility === 'manager'
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                          {rec.visibility === 'me' && <Lock className="w-2.5 h-2.5" />}
                          {rec.visibility === 'manager' && <Users className="w-2.5 h-2.5" />}
                          {rec.visibility === 'all' && <Globe className="w-2.5 h-2.5" />}
                          <span className="capitalize">{rec.visibility === 'me' ? 'Private' : rec.visibility}</span>
                        </span>
                      </td>

                      {/* Last Changed By & Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {rec.updated_by_name ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#F3EFF8] text-[#4A337A] border border-[#D8BFD8] font-bold text-[10.5px]">
                              <UserCheck className="w-3 h-3 text-[#6B46C1]" />
                              <span>{rec.updated_by_name}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-[10px] text-[#584E6B]">
                              <Clock className="w-2.5 h-2.5 text-[#8C82A0] shrink-0" />
                              <span>{formatIndianDateTime(rec.updated_at || rec.created_at)}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center space-x-1 text-[10.5px] text-[#584E6B] font-semibold">
                              <UserCheck className="w-3 h-3 text-[#8C82A0]" />
                              <span>{rec.user_name || 'System'} (Created)</span>
                            </span>
                            <div className="flex items-center space-x-1 text-[10px] text-[#8C82A0]">
                              <Clock className="w-2.5 h-2.5 shrink-0" />
                              <span>{formatIndianDateTime(rec.created_at || rec.entered_date)}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => handleOpenEdit(rec)}
                          className="text-[#584E6B] hover:text-[#6B46C1] p-1 transition cursor-pointer"
                          title="Edit details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {rowDeletable && (
                          <button
                            onClick={() => handleDelete(rec.id)}
                            className="text-[#8C82A0] hover:text-red-600 p-1 transition cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. MODAL FOR CREATE / EDIT RECORD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E2DEEC] relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DEEC]">
              <h3 className="text-base font-bold text-[#1E182B]">
                {editingRecord ? 'Edit Bidding Record' : 'Create Bidding Engagement Record'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C82A0] hover:text-[#1E182B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">Company / Authority Name *</label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  placeholder="e.g. Western Railway, NHM, Indian Oil"
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Status (Hot / Warm / Cold)</label>
                  <select
                    value={formData.lead_status}
                    onChange={(e) => setFormData({ ...formData, lead_status: e.target.value })}
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                  >
                    <option value="Hot">🔥 Hot (High Interest / Urgent)</option>
                    <option value="Warm">⚡ Warm (Active Discussion)</option>
                    <option value="Cold">❄️ Cold (Delayed / Low Interest)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Visibility Level</label>
                  <select
                    value={formData.visibility}
                    onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                  >
                    <option value="all">🌐 All Members</option>
                    <option value="manager">👥 Managers & Admin</option>
                    <option value="me">🔒 Private (Only Me & Admin)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">Bid Pipeline Stage</label>
                <select
                  value={formData.pipeline_stage}
                  onChange={(e) => setFormData({ ...formData, pipeline_stage: e.target.value })}
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                >
                  {PIPELINE_STAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Client Name</label>
                  <input
                    type="text"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Designation</label>
                  <input
                    type="text"
                    value={formData.client_designation}
                    onChange={(e) => setFormData({ ...formData, client_designation: e.target.value })}
                    placeholder="e.g. Superintending Engineer"
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Email ID</label>
                  <input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    placeholder="e.g. r.sharma@gov.in"
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">Remarks (What was the conversation?)</label>
                <textarea
                  rows={4}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Record call discussions, technical queries, pre-bid meeting points..."
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg p-3 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white leading-relaxed"
                />
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-[#E2DEEC]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-[#E2DEEC] rounded-lg text-[#584E6B] font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2 bg-[#6B46C1] hover:bg-[#553C9A] text-white font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? 'Saving...' : editingRecord ? 'Update Record' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. REMARKS POPUP MODAL */}
      {isRemarksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2DEEC] relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DEEC]">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-[#6B46C1]" />
                <h3 className="text-sm font-bold text-[#1E182B]">
                  Discussion & Remarks: {remarksRecord?.company_name}
                </h3>
              </div>
              <button
                onClick={() => setIsRemarksModalOpen(false)}
                className="text-[#8C82A0] hover:text-[#1E182B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-[#1E182B]">
                Conversation Log
              </label>
              <textarea
                rows={5}
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                placeholder="Log discussion points, customer feedback, next meeting date..."
                className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-xl p-3 text-xs text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white leading-relaxed"
              />
            </div>

            <div className="mt-4 pt-3 flex justify-end space-x-2 border-t border-[#E2DEEC]">
              <button
                onClick={() => setIsRemarksModalOpen(false)}
                className="px-3.5 py-1.5 border border-[#E2DEEC] rounded-lg text-xs font-semibold text-[#584E6B] hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRemarks}
                className="px-4 py-1.5 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer"
              >
                Save Remarks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL FOR BULK IMPORT */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E2DEEC] relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DEEC]">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-[#6B46C1]" />
                <h3 className="text-base font-bold text-[#1E182B]">
                  Import CRM Leads (Excel / CSV)
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setSelectedFile(null);
                  setImportFeedback(null);
                }}
                className="text-[#8C82A0] hover:text-[#1E182B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Info banner about visibility and audit */}
              <div className="bg-[#FAF9FD] p-3.5 rounded-xl border border-[#E2DEEC] text-xs space-y-2">
                <div className="flex items-start space-x-2 text-[#1E182B] font-semibold">
                  <Globe className="w-4 h-4 text-[#6B46C1] shrink-0 mt-0.5" />
                  <span>Visibility set to <strong className="text-[#6B46C1]">All Members</strong> automatically.</span>
                </div>
                <p className="text-[#584E6B] text-[11px] leading-relaxed">
                  Every uploaded lead is saved with visibility <code className="bg-white px-1.5 py-0.5 rounded border border-[#E2DEEC] font-semibold text-[#6B46C1]">all</code> so your entire bidding team can collaborate. The action will be logged in the system Audit Trail.
                </p>
              </div>

              {/* Supported Columns overview */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-[#584E6B]">
                <div className="font-semibold text-[#1E182B] mb-1.5">Expected Spreadsheet Headers:</div>
                <div className="flex flex-wrap gap-1 font-mono text-[10px] text-slate-700">
                  {['Sr No', 'Date', 'Status', 'Client', 'Name', 'Number', 'Remarks', 'Designation', 'Email ID'].map((col) => (
                    <span key={col} className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold">
                      {col}
                    </span>
                  ))}
                </div>
              </div>

              {/* Download Template Link */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[#584E6B]">Need the exact template?</span>
                <a
                  href="/api/v1/crm-records/template"
                  download="CRM_Leads_Import_Template.xlsx"
                  className="inline-flex items-center space-x-1.5 text-[#6B46C1] hover:text-[#553C9A] font-semibold hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample Template</span>
                </a>
              </div>

              {/* File Dropzone */}
              <form onSubmit={handleImportSubmit} className="space-y-4">
                <div className="border-2 border-dashed border-[#D8BFD8] hover:border-[#6B46C1] transition rounded-2xl p-6 text-center bg-[#FAF9FD]/60">
                  <input
                    type="file"
                    id="crm-file-upload"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        setImportFeedback(null);
                      }
                    }}
                  />
                  <label htmlFor="crm-file-upload" className="cursor-pointer block space-y-2">
                    <Upload className="w-8 h-8 text-[#6B46C1] mx-auto opacity-80" />
                    <div className="text-xs font-semibold text-[#1E182B]">
                      {selectedFile ? (
                        <span className="text-[#6B46C1] font-bold">{selectedFile.name}</span>
                      ) : (
                        <span>Click to choose file or drag & drop</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8C82A0]">
                      Supports Excel (.xlsx, .xls) and CSV (.csv)
                    </div>
                  </label>
                </div>

                {/* Feedback */}
                {importFeedback && (
                  <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${importFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                    {importFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                    )}
                    <span className="leading-relaxed font-medium">{importFeedback.message}</span>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-3 flex justify-end space-x-2 border-t border-[#E2DEEC]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setSelectedFile(null);
                      setImportFeedback(null);
                    }}
                    className="px-4 py-2 border border-[#E2DEEC] rounded-lg text-xs font-semibold text-[#584E6B] hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedFile || isImporting}
                    className="inline-flex items-center space-x-1.5 px-5 py-2 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Importing Leads...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload & Import</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

