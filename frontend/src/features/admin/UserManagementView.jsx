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
  AlertCircle,
  Trash2,
  Edit2
} from 'lucide-react';

const AVAILABLE_PERMISSIONS = [
  { key: 'can_view_audit', label: 'View Audit Logs', desc: 'Allows access to company audit trail' },
  { key: 'can_export', label: 'Export Data', desc: 'Allows downloading Excel/CSV tenders' },
  { key: 'can_delete_tenders', label: 'Delete Records', desc: 'Allows deleting individual tender bids and CRM records' },
  { key: 'can_bulk_delete_expired', label: 'Bulk Delete Past Tenders', desc: 'Allows bulk purging expired tenders not in the bid pipeline' },
  { key: 'can_manage_scrapers', label: 'Trigger Sync', desc: 'Allows running GeM and portal scrapers' },
];

export const UserManagementView = () => {
  const { user, isSuperAdmin, isManager, showNotification } = useApp();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'executive',
    permissions: [],
    is_active: true
  });

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
    if (!isSuperAdmin && (permKey === 'can_delete_tenders' || permKey === 'can_bulk_delete_expired')) {
      showNotification('Only Super Admin can grant or revoke deletion rights', 'error');
      return;
    }
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

  // Inline Role Change (Super Admin only)
  const handleRoleChange = async (targetUser, newRole) => {
    if (targetUser.id === user?.id) {
      showNotification('You cannot change your own Super Admin role', 'error');
      return;
    }
    if (newRole === targetUser.role) return;

    try {
      const res = await usersApi.updateUser(targetUser.id, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? res.data : u)));
      showNotification(`Updated ${targetUser.username}'s role to ${newRole.replace('_', ' ')}`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to update user role', 'error');
    }
  };

  // Open Edit User Modal (Super Admin only)
  const handleOpenEditModal = (targetUser) => {
    setEditingUser(targetUser);
    setEditFormData({
      username: targetUser.username || '',
      email: targetUser.email || '',
      password: '',
      role: targetUser.role || 'executive',
      permissions: targetUser.permissions || [],
      is_active: targetUser.is_active
    });
    setIsEditModalOpen(true);
  };

  // Submit Edit User Modal (Super Admin only)
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    const payload = {
      username: editFormData.username.trim(),
      email: editFormData.email.trim(),
      role: editFormData.role,
      permissions: editFormData.permissions,
      is_active: editFormData.is_active
    };
    if (editFormData.password.trim()) {
      payload.password = editFormData.password.trim();
    }

    setSubmitting(true);
    try {
      const res = await usersApi.updateUser(editingUser.id, payload);
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data : u)));
      showNotification(`User '${res.data.username}' updated successfully`, 'success');
      setIsEditModalOpen(false);
      setEditingUser(null);
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to update user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete User (Super Admin only)
  const handleDeleteUser = async (targetUser) => {
    if (targetUser.id === user?.id) {
      showNotification('You cannot delete your own Super Admin account', 'error');
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete user "${targetUser.username}" (${targetUser.role})?\n\nThis will release any claimed tenders and remove user access immediately.`
    );
    if (!confirmed) return;

    try {
      await usersApi.deleteUser(targetUser.id);
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      showNotification(`User '${targetUser.username}' deleted successfully`, 'success');
    } catch (err) {
      showNotification(err.response?.data?.detail || 'Failed to delete user', 'error');
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

                      {/* Role Badge / Inline Role Selector (Super Admin) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isSuperAdmin && !isCurrent ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value)}
                            className={`text-[11px] font-bold py-1 px-2.5 rounded-full border cursor-pointer outline-none transition ${
                              u.role === 'super_admin'
                                ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                                : u.role === 'manager'
                                ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title="Change user role"
                          >
                            <option value="executive">Executive</option>
                            <option value="manager">Manager</option>
                            <option value="super_admin">Super Admin</option>
                          </select>
                        ) : (
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
                        )}
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
                            const isDeletePerm = perm.key === 'can_delete_tenders' || perm.key === 'can_bulk_delete_expired';
                            const isPermEditable = canEdit && !isCurrent && (!isDeletePerm || isSuperAdmin);
                            return (
                              <button
                                key={perm.key}
                                onClick={() => isPermEditable && handleTogglePermission(u, perm.key)}
                                disabled={!isPermEditable}
                                title={!isSuperAdmin && isDeletePerm ? 'Only Super Admin can grant or revoke deletion rights' : `${perm.label}: ${perm.desc}`}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                                  isGranted
                                    ? 'bg-[#EFEBF8] text-[#6B46C1] border-[#D8BFD8]'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 opacity-60'
                                } ${isPermEditable ? 'cursor-pointer hover:border-[#6B46C1]' : 'cursor-not-allowed opacity-50'}`}
                              >
                                {perm.label} {isGranted ? '✓' : '×'}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isSuperAdmin && !isCurrent ? (
                          <div className="inline-flex items-center space-x-1.5">
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#6B46C1] bg-[#EFEBF8] hover:bg-[#E2D9F3] border border-[#D8BFD8] transition cursor-pointer"
                              title={`Edit user ${u.username}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                              title={`Permanently delete user ${u.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        ) : isCurrent ? (
                          <span className="text-[11px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                            Current User
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#8C82A0]">
                            {canEdit ? 'Editable' : 'Read Only'}
                          </span>
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


      {/* 4. MODAL: EDIT USER (SUPER ADMIN) */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E2DEEC] relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2DEEC]">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-[#6B46C1]" />
                <h3 className="text-base font-bold text-[#1E182B]">
                  Edit User: {editingUser.username}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingUser(null);
                }}
                className="text-[#8C82A0] hover:text-[#1E182B] p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={editFormData.username}
                  onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Role</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                  >
                    <option value="executive">Executive</option>
                    <option value="manager">Manager</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1E182B] mb-1">Account Status</label>
                  <select
                    value={editFormData.is_active ? 'active' : 'disabled'}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'active' })}
                    className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1E182B] mb-1">
                  Reset Password <span className="text-[#8C82A0] font-normal">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  minLength={6}
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] rounded-lg px-3 py-2 text-[#1E182B] outline-none focus:border-[#6B46C1] focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1E182B] mb-1.5">Granular Permissions</label>
                <div className="space-y-1.5 bg-[#FAF9FD] p-3 rounded-xl border border-[#E2DEEC]">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const checked = editFormData.permissions.includes(perm.key);
                    return (
                      <label key={perm.key} className="flex items-start space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? editFormData.permissions.filter((p) => p !== perm.key)
                              : [...editFormData.permissions, perm.key];
                            setEditFormData({ ...editFormData, permissions: next });
                          }}
                          className="mt-0.5 w-3.5 h-3.5 rounded border-[#D8BFD8] text-[#6B46C1] focus:ring-[#6B46C1]"
                        />
                        <div>
                          <div className="font-semibold text-[#1E182B]">{perm.label}</div>
                          <div className="text-[10px] text-[#584E6B]">{perm.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-[#E2DEEC]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingUser(null);
                  }}
                  className="px-4 py-2 border border-[#E2DEEC] rounded-lg text-[#584E6B] font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#6B46C1] hover:bg-[#553C9A] text-white font-semibold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
