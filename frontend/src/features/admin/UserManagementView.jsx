import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { usersApi } from '../../utils/api';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Lock,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { key: 'can_view_audit', label: 'View Audit Logs', desc: 'Allows access to company audit trail' },
  { key: 'can_export', label: 'Export Data', desc: 'Allows downloading Excel/CSV tenders' },
  { key: 'can_delete_tenders', label: 'Delete Records', desc: 'Allows deleting CRM or tender bids' },
  { key: 'can_manage_scrapers', label: 'Trigger Sync', desc: 'Allows running GeM and portal scrapers' },
];

export const UserManagementView = () => {
  const { user, isSuperAdmin, isManager, showNotification } = useApp();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'executive',
    permissions: ['can_export']
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getUsers();
      setUsers(res.data.items || []);
    } catch (err) {
      showNotification('Failed to load user accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle Create User
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await usersApi.createUser(formData);
      showNotification(`User '${formData.username}' created successfully`, 'success');
      setIsModalOpen(false);
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'executive',
        permissions: ['can_export']
      });
      fetchUsers();
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to create user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Single Permission
  const handleTogglePermission = async (targetUser, permKey) => {
    const currentPerms = targetUser.permissions || [];
    const nextPerms = currentPerms.includes(permKey)
      ? currentPerms.filter((p) => p !== permKey)
      : [...currentPerms, permKey];

    try {
      await usersApi.updatePermissions(targetUser.id, nextPerms);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, permissions: nextPerms } : u))
      );
      showNotification(`Permissions updated for ${targetUser.username}`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to update permissions', 'error');
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (targetUser) => {
    if (targetUser.id === user?.id) {
      showNotification('You cannot deactivate your own account', 'error');
      return;
    }
    const nextStatus = !targetUser.is_active;
    try {
      await usersApi.updateStatus(targetUser.id, nextStatus);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextStatus } : u))
      );
      showNotification(`User ${targetUser.username} ${nextStatus ? 'activated' : 'deactivated'}`, 'info');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to change status', 'error');
    }
  };

  return (
    <div className="space-y-5 w-full">
      {/* 1. HEADER */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2DEEC] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-[#1E182B] tracking-tight">
              User & Rights Management
            </h1>
            <span className="bg-[#EFEBF8] text-[#6B46C1] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#D8BFD8]/50">
              {isSuperAdmin ? 'Full System Administration' : 'Executive Team Governance'}
            </span>
          </div>
          <p className="text-xs text-[#584E6B] mt-1">
            {isSuperAdmin
              ? 'Provision Managers & Executives, assign global governance roles, and grant granular rights.'
              : 'Provision Executive team members and manage their system permissions.'}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center space-x-2 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-purple-900/10 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{isSuperAdmin ? 'Create New User' : 'Add Executive'}</span>
        </button>
      </div>

      {/* 2. USERS TABLE */}
      <div className="bg-white rounded-xl border border-[#E2DEEC] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#6B46C1]" />
            <span className="text-xs text-[#584E6B] font-medium">Loading user accounts...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Users className="w-10 h-10 text-[#8C82A0] mx-auto opacity-40" />
            <h3 className="text-sm font-bold text-[#1E182B]">No Users Found</h3>
            <p className="text-xs text-[#584E6B] max-w-sm mx-auto">
              Click the button above to add the first user to your team.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF9FD] border-b border-[#E2DEEC] text-[#584E6B] font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created By</th>
                  <th className="py-3 px-4">Granular Permissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DEEC]">
                {users.map((u) => {
                  const isCurrent = u.id === user?.id;
                  const canEdit = isSuperAdmin || (isManager && u.role === 'executive' && u.created_by_id === user?.id);

                  return (
                    <tr key={u.id} className="hover:bg-[#FAF9FD]/80 transition">
                      
                      {/* User Info */}
                      <td className="py-3.5 px-4 font-semibold text-[#1E182B] whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-[#EFEBF8] text-[#6B46C1] font-bold flex items-center justify-center text-xs border border-[#D8BFD8]">
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-[#1E182B] flex items-center space-x-1.5">
                              <span>{u.username}</span>
                              {isCurrent && (
                                <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#584E6B]">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          u.role === 'super_admin'
                            ? 'bg-purple-50 text-purple-800 border-purple-200'
                            : u.role === 'manager'
                            ? 'bg-blue-50 text-blue-800 border-blue-200'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          <span className="capitalize">{u.role.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => canEdit && handleToggleStatus(u)}
                          disabled={!canEdit || isCurrent}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            u.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          } ${canEdit && !isCurrent ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                          title={canEdit && !isCurrent ? 'Click to toggle active status' : ''}
                        >
                          {u.is_active ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                          <span>{u.is_active ? 'Active' : 'Disabled'}</span>
                        </button>
                      </td>

                      {/* Created By */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#584E6B]">
                        {u.created_by_name ? (
                          <span>{u.created_by_name}</span>
                        ) : (
                          <span className="text-[#8C82A0] italic">System / Initial</span>
                        )}
                      </td>

                      {/* Granular Rights Toggles */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {AVAILABLE_PERMISSIONS.map((perm) => {
                            const isGranted = (u.permissions || []).includes(perm.key);
                            return (
                              <button
                                key={perm.key}
                                onClick={() => canEdit && handleTogglePermission(u, perm.key)}
                                disabled={!canEdit || isCurrent}
                                title={`${perm.label}: ${perm.desc}`}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                                  isGranted
                                    ? 'bg-[#EFEBF8] text-[#6B46C1] border-[#D8BFD8]'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                                } ${canEdit && !isCurrent ? 'cursor-pointer hover:border-[#6B46C1]' : 'cursor-default'}`}
                              >
                                {perm.label} {isGranted ? '✓' : '×'}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="text-[11px] text-[#8C82A0]">
                          {canEdit ? 'Editable' : 'Read Only'}
                        </span>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. MODAL: CREATE USER */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2DEEC] relative">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DEEC]">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-[#6B46C1]" />
                <h3 className="text-base font-bold text-[#1E182B]">
                  {isSuperAdmin ? 'Provision New User' : 'Provision Executive Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8C82A0] hover:text-[#1E182B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. rahul_bids"
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. rahul@bitvivid.com"
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 6 characters"
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Assigned Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                  >
                    <option value="executive">Executive (Bidding & CRM)</option>
                    <option value="manager">Manager (Team & Tender Management)</option>
                    <option value="super_admin">Super Admin (Full Governance)</option>
                  </select>
                </div>
              )}

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
                  disabled={submitting}
                  className="px-5 py-2 bg-[#6B46C1] hover:bg-[#553C9A] text-white font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Provisioning...' : 'Provision Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

