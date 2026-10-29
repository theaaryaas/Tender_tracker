import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { settingsApi } from '../../utils/api';
import { Save, Plus, Trash2, Building, ShieldCheck, Tag } from 'lucide-react';

export const SettingsView = () => {
  const { showNotification } = useApp();
  const [profile, setProfile] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingKeywords, setSavingKeywords] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [profRes, kwRes] = await Promise.all([
          settingsApi.getProfile(),
          settingsApi.getKeywords(),
        ]);
        setProfile(profRes.data || {});
        setKeywords(kwRes.data?.keywords || []);
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await settingsApi.updateProfile(profile);
      showNotification('Company profile updated successfully', 'success');
    } catch (err) {
      showNotification('Failed to update company profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    if (keywords.includes(newKeyword.trim())) return;
    setKeywords([...keywords, newKeyword.trim()]);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleSaveKeywords = async () => {
    setSavingKeywords(true);
    try {
      await settingsApi.updateKeywords({ keywords });
      showNotification('Search keywords saved', 'success');
    } catch (e) {
      showNotification('Failed to save keywords', 'error');
    } finally {
      setSavingKeywords(false);
    }
  };

  if (!profile) return <div className="text-center py-12 text-slate-400">Loading settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Application & Company Settings</h2>
        <p className="text-xs text-slate-500">
          Configure BitVivid company qualifications, certifications, and search discovery terms.
        </p>
      </div>

      {/* Company Profile Card */}
      <form onSubmit={handleProfileSave} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
            <Building className="w-4 h-4 text-blue-600" />
            <span>BitVivid Corporate Profile & Qualifications</span>
          </div>
          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
            <input
              type="text"
              value={profile.company_name || ''}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Annual Turnover (INR in ₹ Lakhs / Cr)</label>
            <input
              type="number"
              placeholder="e.g. 50000000"
              value={profile.average_annual_turnover_inr || ''}
              onChange={(e) => setProfile({ ...profile, average_annual_turnover_inr: parseFloat(e.target.value) || null })}
              className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">MSME / Udyam Status</label>
            <input
              type="text"
              value={profile.msme_status || ''}
              onChange={(e) => setProfile({ ...profile, msme_status: e.target.value })}
              className="w-full p-2 rounded-lg border border-slate-300 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-4 pt-5">
            <label className="inline-flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.udyam_registered || false}
                onChange={(e) => setProfile({ ...profile, udyam_registered: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="font-semibold text-slate-700">Udyam Registered</span>
            </label>

            <label className="inline-flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.dpiit_startup_recognised || false}
                onChange={(e) => setProfile({ ...profile, dpiit_startup_recognised: e.target.checked })}
                className="rounded text-blue-600"
              />
              <span className="font-semibold text-slate-700">DPIIT Startup</span>
            </label>
          </div>
        </div>

        {/* Certifications Display */}
        <div className="space-y-2 pt-2">
          <label className="block text-xs font-semibold text-slate-700">Active Certifications</label>
          <div className="flex flex-wrap gap-2">
            {(profile.known_certifications || []).map((cert, i) => (
              <span key={i} className="text-xs bg-slate-100 border border-slate-200 px-2.5 py-1 rounded font-medium text-slate-700">
                {cert}
              </span>
            ))}
          </div>
        </div>
      </form>

      {/* Keywords Manager Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
            <Tag className="w-4 h-4 text-indigo-600" />
            <span>Search Discovery Keywords ({keywords.length})</span>
          </div>
          <button
            onClick={handleSaveKeywords}
            disabled={savingKeywords}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingKeywords ? 'Saving...' : 'Save Keywords'}</span>
          </button>
        </div>

        {/* Add keyword form */}
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Add new search keyword (e.g. Red Light Violation Detection)..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
            className="flex-1 p-2 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* Keyword Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center space-x-1 text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded-full font-medium"
            >
              <span>{kw}</span>
              <button
                onClick={() => handleRemoveKeyword(kw)}
                className="hover:text-rose-600 p-0.5 rounded-full"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

