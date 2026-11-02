import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { settingsApi } from '../../utils/api';
import { 
  Sliders,
  Save, 
  Plus, 
  Trash2, 
  Building, 
  Tag, 
  Award, 
  CheckCircle2,
  ShieldCheck,
  FileCheck
} from 'lucide-react';

export const SettingsView = () => {
  const { showNotification } = useApp();
  const [profile, setProfile] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCert, setNewCert] = useState('');
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
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    if (keywords.includes(trimmed)) {
      showNotification('Keyword already exists', 'info');
      return;
    }
    setKeywords([...keywords, trimmed]);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kw) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleAddCert = () => {
    const trimmed = newCert.trim();
    if (!trimmed) return;
    const certs = profile.known_certifications || [];
    if (certs.includes(trimmed)) return;
    setProfile({ ...profile, known_certifications: [...certs, trimmed] });
    setNewCert('');
  };

  const handleRemoveCert = (cert) => {
    const certs = profile.known_certifications || [];
    setProfile({ ...profile, known_certifications: certs.filter((c) => c !== cert) });
  };

  const handleSaveKeywords = async () => {
    setSavingKeywords(true);
    try {
      await settingsApi.updateKeywords({ keywords });
      showNotification('Search keywords saved successfully', 'success');
    } catch (e) {
      showNotification('Failed to save keywords', 'error');
    } finally {
      setSavingKeywords(false);
    }
  };

  const formatAmountPreview = (amount) => {
    if (!amount || isNaN(amount)) return '';
    const num = parseFloat(amount);
    if (num >= 10000000) {
      return `≈ ₹ ${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `≈ ₹ ${(num / 100000).toFixed(2)} Lakh`;
    }
    return `≈ ₹ ${num.toLocaleString('en-IN')}`;
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold">Loading settings & company profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* 1. Page Header Banner Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 text-blue-600 flex items-center justify-center font-bold shrink-0 shadow-2xs">
            <Sliders className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Application & Company Settings
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Configure BitVivid company qualifications, certifications, and search discovery terms.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Card 1: Corporate Profile & Financial Criteria */}
      <form onSubmit={handleProfileSave} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
        {/* Card Header with Aligned Save Button */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Corporate Profile & Qualifications</h3>
              <p className="text-xs text-slate-500">Parameters used to calculate tender direct-fit and SI partner readiness</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5 transition cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>

        {/* Section A: Company Identity (Symmetrical 2-Column Grid) */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Company Name
              </label>
              <input
                type="text"
                value={profile.company_name || ''}
                onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                placeholder="e.g. BitVivid Solutions Pvt Ltd"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Direct Bidder Category
              </label>
              <input
                type="text"
                value={profile.direct_bidder_type || ''}
                onChange={(e) => setProfile({ ...profile, direct_bidder_type: e.target.value })}
                placeholder="e.g. Software/Product OEM and Solution Provider"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Section B: Financial Metrics (Symmetrical 2-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Avg Annual Turnover (INR)
                </label>
                {profile.average_annual_turnover_inr && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {formatAmountPreview(profile.average_annual_turnover_inr)}
                  </span>
                )}
              </div>
              <input
                type="number"
                placeholder="e.g. 50000000"
                value={profile.average_annual_turnover_inr || ''}
                onChange={(e) => setProfile({ ...profile, average_annual_turnover_inr: parseFloat(e.target.value) || null })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Net Worth (INR)
                </label>
                {profile.net_worth_inr && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {formatAmountPreview(profile.net_worth_inr)}
                  </span>
                )}
              </div>
              <input
                type="number"
                placeholder="e.g. 25000000"
                value={profile.net_worth_inr || ''}
                onChange={(e) => setProfile({ ...profile, net_worth_inr: parseFloat(e.target.value) || null })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Section C: Accreditations (Clean 4-Column Responsive Grid) */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Government Accreditations & Exemptions
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Udyam Status */}
              <label className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                profile.udyam_registered ? 'bg-blue-50/70 border-blue-200 text-blue-950' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={profile.udyam_registered || false}
                    onChange={(e) => setProfile({ ...profile, udyam_registered: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold">Udyam / MSME</span>
                </div>
                <span className="text-[10.5px] text-slate-500 leading-tight mt-2">
                  EMD waiver & experience relaxation on GeM bids.
                </span>
              </label>

              {/* DPIIT Startup */}
              <label className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                profile.dpiit_startup_recognised ? 'bg-blue-50/70 border-blue-200 text-blue-950' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={profile.dpiit_startup_recognised || false}
                    onChange={(e) => setProfile({ ...profile, dpiit_startup_recognised: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold">DPIIT Startup</span>
                </div>
                <span className="text-[10.5px] text-slate-500 leading-tight mt-2">
                  Startup India turnover & prior experience relaxations.
                </span>
              </label>

              {/* GeM Registered */}
              <label className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                profile.gem_registered ? 'bg-blue-50/70 border-blue-200 text-blue-950' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={profile.gem_registered ?? true}
                    onChange={(e) => setProfile({ ...profile, gem_registered: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold">GeM Registered</span>
                </div>
                <span className="text-[10.5px] text-slate-500 leading-tight mt-2">
                  Verified vendor account for direct GeM BidPlus bidding.
                </span>
              </label>

              {/* Non-Blacklisted Confirmation */}
              <label className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                profile.blacklisting_status_confirmed ? 'bg-blue-50/70 border-blue-200 text-blue-950' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={profile.blacklisting_status_confirmed ?? true}
                    onChange={(e) => setProfile({ ...profile, blacklisting_status_confirmed: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold">Clean Record</span>
                </div>
                <span className="text-[10.5px] text-slate-500 leading-tight mt-2">
                  Confirmed zero blacklisting/debarment on portals.
                </span>
              </label>
            </div>
          </div>

          {/* Section D: Active Certifications */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Active Certifications & Compliance Standards
            </label>

            {/* Add Certification input */}
            <div className="flex gap-2 max-w-2xl">
              <input
                type="text"
                placeholder="Add certification (e.g. ISO 27001, CMMI Level 3, BIS, CE)..."
                value={newCert}
                onChange={(e) => setNewCert(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCert())}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddCert}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 cursor-pointer transition shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Certifications Badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {(profile.known_certifications || []).map((cert, i) => (
                <span
                  key={i}
                  className="inline-flex items-center space-x-1.5 text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-700"
                >
                  <Award className="w-3.5 h-3.5 text-blue-600" />
                  <span>{cert}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCert(cert)}
                    className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer ml-1"
                    title="Remove certification"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </form>

      {/* 3. Card 2: Search Discovery Keywords */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Search Discovery Keywords ({keywords.length})</h3>
              <p className="text-xs text-slate-500">Keywords used by automated scrapers to match tenders across GeM, CPPP & State Portals</p>
            </div>
          </div>

          <button
            onClick={handleSaveKeywords}
            disabled={savingKeywords}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm inline-flex items-center space-x-1.5 transition cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingKeywords ? 'Saving...' : 'Save Keywords'}</span>
          </button>
        </div>

        {/* Add keyword form */}
        <div className="flex gap-2 max-w-2xl">
          <input
            type="text"
            placeholder="Add keyword (e.g. Video Analytics, ANPR, Traffic Management)..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 cursor-pointer transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>

        {/* Keyword Pills Container */}
        <div className="flex flex-wrap gap-2 pt-1">
          {keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center space-x-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-lg font-medium hover:border-blue-300 transition"
            >
              <span>{kw}</span>
              <button
                onClick={() => handleRemoveKeyword(kw)}
                className="text-blue-400 hover:text-rose-600 p-0.5 rounded cursor-pointer ml-0.5"
                title={`Remove ${kw}`}
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

export default SettingsView;
