import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { settingsApi } from '../../utils/api';
import { 
  Building, 
  Tag, 
  Award, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ShieldCheck, 
  Rocket, 
  FileCheck
} from 'lucide-react';

const COMMON_CERTS = [
  'ISO 9001:2015',
  'ISO 27001:2013',
  'ISO 20000-1:2018',
  'CMMI Maturity Level 5',
  'CMMI Maturity Level 3',
  'BIS Certification',
  'STQC Certified'
];

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

  const handleAddCert = (name) => {
    const trimmed = (name || newCert).trim();
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
          <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* 1. Sleek Typographic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Application & Company Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure BitVivid company credentials, financial thresholds, and AI discovery keyword scrapers
          </p>
        </div>
      </div>

      {/* 2. Corporate Profile Card */}
      <form onSubmit={handleProfileSave} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Corporate Profile & Qualifications</h3>
              <p className="text-xs text-slate-500">Parameters utilized to determine tender direct fit and partner consortium readiness</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>

        {/* Section A: Company Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Registered Company Name
            </label>
            <input
              type="text"
              value={profile.company_name || ''}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="BitVivid Solutions Private Limited"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
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
              placeholder="Software/Product OEM and Solution Provider"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Section B: Financial Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Average Annual Turnover (INR)
              </label>
              {profile.average_annual_turnover_inr && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {formatAmountPreview(profile.average_annual_turnover_inr)}
                </span>
              )}
            </div>
            <input
              type="number"
              placeholder="50000000"
              value={profile.average_annual_turnover_inr || ''}
              onChange={(e) => setProfile({ ...profile, average_annual_turnover_inr: parseFloat(e.target.value) || null })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
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
              placeholder="25000000"
              value={profile.net_worth_inr || ''}
              onChange={(e) => setProfile({ ...profile, net_worth_inr: parseFloat(e.target.value) || null })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Section C: Government Accreditations (Modern Toggle Tiles) */}
        <div className="space-y-2.5 pt-1">
          <label className="block text-xs font-semibold text-slate-700">
            Government Accreditations &amp; Exemption Eligibility
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Udyam */}
            <div
              onClick={() => setProfile({ ...profile, udyam_registered: !profile.udyam_registered })}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                profile.udyam_registered 
                  ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className={`w-4 h-4 ${profile.udyam_registered ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Udyam / MSME</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${profile.udyam_registered ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {profile.udyam_registered ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                EMD waiver and prior experience relaxations on GeM and CPPP portals.
              </p>
            </div>

            {/* DPIIT */}
            <div
              onClick={() => setProfile({ ...profile, dpiit_startup_recognised: !profile.dpiit_startup_recognised })}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                profile.dpiit_startup_recognised 
                  ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Rocket className={`w-4 h-4 ${profile.dpiit_startup_recognised ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">DPIIT Startup</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${profile.dpiit_startup_recognised ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {profile.dpiit_startup_recognised ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Startup India turnover and prior experience relaxations for recognized tech firms.
              </p>
            </div>

            {/* GeM Registered */}
            <div
              onClick={() => setProfile({ ...profile, gem_registered: !profile.gem_registered })}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                profile.gem_registered 
                  ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Building className={`w-4 h-4 ${profile.gem_registered ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">GeM Registered</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${profile.gem_registered ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {profile.gem_registered ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Verified seller account enabled for direct bidding on GeM BidPlus tenders.
              </p>
            </div>

            {/* Clean Record */}
            <div
              onClick={() => setProfile({ ...profile, blacklisting_status_confirmed: !profile.blacklisting_status_confirmed })}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                profile.blacklisting_status_confirmed 
                  ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className={`w-4 h-4 ${profile.blacklisting_status_confirmed ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Clean Record</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${profile.blacklisting_status_confirmed ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {profile.blacklisting_status_confirmed ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Confirmed zero debarment or blacklisting across central and state authorities.
              </p>
            </div>
          </div>
        </div>

        {/* Section D: Active Certifications */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <label className="block text-xs font-semibold text-slate-700">
            Active Certifications &amp; Compliance Standards
          </label>

          {/* Quick Preset Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-400 font-medium">Quick add:</span>
            {COMMON_CERTS.map((cert) => {
              const alreadyHas = (profile.known_certifications || []).includes(cert);
              if (alreadyHas) return null;
              return (
                <button
                  type="button"
                  key={cert}
                  onClick={() => handleAddCert(cert)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-[11px] font-medium border border-slate-200 transition cursor-pointer"
                >
                  + {cert}
                </button>
              );
            })}
          </div>

          {/* Custom Input */}
          <div className="flex gap-2 max-w-xl">
            <input
              type="text"
              placeholder="Add other certification (e.g. BIS, CE, STQC)..."
              value={newCert}
              onChange={(e) => setNewCert(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCert())}
              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            <button
              type="button"
              onClick={() => handleAddCert()}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 cursor-pointer transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Active Certifications Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {(profile.known_certifications || []).map((cert, i) => (
              <span
                key={i}
                className="inline-flex items-center space-x-1.5 text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-medium text-slate-700 shadow-2xs"
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
      </form>

      {/* 3. Search Discovery Keywords Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Search Discovery Keywords ({keywords.length})
              </h3>
              <p className="text-xs text-slate-500">
                Keywords scraped continuously across GeM BidPlus, CPPP eProcurement, and State Tenders
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveKeywords}
            disabled={savingKeywords}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingKeywords ? 'Saving...' : 'Save Keywords'}</span>
          </button>
        </div>

        {/* Add keyword input */}
        <div className="flex gap-2 max-w-xl">
          <input
            type="text"
            placeholder="Add keyword (e.g. Video Analytics, ANPR, Traffic Management)..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyword())}
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 cursor-pointer transition shrink-0"
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
              className="inline-flex items-center space-x-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-lg font-medium hover:border-blue-300 transition shadow-2xs"
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
