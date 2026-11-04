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
  Sliders
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

export const CompanySettingsView = () => {
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
      <div className="flex items-center justify-center py-20 text-[#8C82A0]">
        <div className="text-center space-y-2">
          <div className="w-7 h-7 border-2 border-[#6B46C1] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[#584E6B]">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* 1. Header Card (Lavender Dream Palette) */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2DEEC] shadow-sm w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#6B46C1] text-white flex items-center justify-center font-bold shadow-md shadow-purple-900/20 shrink-0">
            <Sliders className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-[#1E182B] tracking-tight leading-tight">
                Application &amp; Company Settings
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[#E6E6FA] text-[#4A337A] border border-[#D8BFD8] shadow-2xs">
                Company Config
              </span>
            </div>
            <p className="text-xs font-medium text-[#584E6B] mt-1">
              Configure BitVivid company credentials, financial thresholds, and AI discovery keyword scrapers
            </p>
          </div>
        </div>
      </div>

      {/* 2. Corporate Profile Card */}
      <form onSubmit={handleProfileSave} className="bg-white rounded-2xl border border-[#E2DEEC] shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#F0EDF7]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6E6FA] border border-[#D8BFD8] text-[#4A337A] flex items-center justify-center font-bold">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#1E182B]">Corporate Profile &amp; Qualifications</h3>
              <p className="text-xs text-[#8C82A0]">Parameters utilized to determine tender direct fit and partner consortium readiness</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-4 py-2 bg-[#6B46C1] hover:bg-[#553C9A] disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>

        {/* Section A: Company Identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E182B] mb-1.5">
              Registered Company Name
            </label>
            <input
              type="text"
              value={profile.company_name || ''}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="BitVivid Solutions Private Limited"
              className="w-full px-3 py-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] text-xs font-medium text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E182B] mb-1.5">
              Direct Bidder Category
            </label>
            <input
              type="text"
              value={profile.direct_bidder_type || ''}
              onChange={(e) => setProfile({ ...profile, direct_bidder_type: e.target.value })}
              placeholder="Software/Product OEM and Solution Provider"
              className="w-full px-3 py-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] text-xs font-medium text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
            />
          </div>
        </div>

        {/* Section B: Financial Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#1E182B]">
                Average Annual Turnover (INR)
              </label>
              {profile.average_annual_turnover_inr && (
                <span className="text-[11px] font-bold text-[#244E2C] bg-[#E8F3E6] px-2 py-0.5 rounded border border-[#C8D8C4] font-mono">
                  {formatAmountPreview(profile.average_annual_turnover_inr)}
                </span>
              )}
            </div>
            <input
              type="number"
              placeholder="50000000"
              value={profile.average_annual_turnover_inr || ''}
              onChange={(e) => setProfile({ ...profile, average_annual_turnover_inr: parseFloat(e.target.value) || null })}
              className="w-full px-3 py-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] text-xs font-medium text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#1E182B]">
                Net Worth (INR)
              </label>
              {profile.net_worth_inr && (
                <span className="text-[11px] font-bold text-[#244E2C] bg-[#E8F3E6] px-2 py-0.5 rounded border border-[#C8D8C4] font-mono">
                  {formatAmountPreview(profile.net_worth_inr)}
                </span>
              )}
            </div>
            <input
              type="number"
              placeholder="25000000"
              value={profile.net_worth_inr || ''}
              onChange={(e) => setProfile({ ...profile, net_worth_inr: parseFloat(e.target.value) || null })}
              className="w-full px-3 py-2 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] text-xs font-medium text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
            />
          </div>
        </div>

        {/* Section C: Government Accreditations */}
        <div className="space-y-2.5 pt-1">
          <label className="block text-xs font-semibold text-[#1E182B]">
            Government Accreditations &amp; Exemption Eligibility
          </label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Udyam */}
            <div
              onClick={() => setProfile({ ...profile, udyam_registered: !profile.udyam_registered })}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                profile.udyam_registered 
                  ? 'bg-[#E6E6FA] border-[#6B46C1] text-[#1E182B] shadow-2xs' 
                  : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B] hover:bg-[#F3EFF8]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className={`w-4 h-4 ${profile.udyam_registered ? 'text-[#6B46C1]' : 'text-[#8C82A0]'}`} />
                  <span className="text-xs font-bold">Udyam / MSME</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${profile.udyam_registered ? 'bg-[#6B46C1] text-white' : 'bg-[#E2DEEC] text-[#584E6B]'}`}>
                  {profile.udyam_registered ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-[#8C82A0] leading-snug">
                EMD waiver and prior experience relaxations on GeM and CPPP portals.
              </p>
            </div>

            {/* DPIIT */}
            <div
              onClick={() => setProfile({ ...profile, dpiit_startup_recognised: !profile.dpiit_startup_recognised })}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                profile.dpiit_startup_recognised 
                  ? 'bg-[#E6E6FA] border-[#6B46C1] text-[#1E182B] shadow-2xs' 
                  : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B] hover:bg-[#F3EFF8]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Rocket className={`w-4 h-4 ${profile.dpiit_startup_recognised ? 'text-[#6B46C1]' : 'text-[#8C82A0]'}`} />
                  <span className="text-xs font-bold">DPIIT Startup</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${profile.dpiit_startup_recognised ? 'bg-[#6B46C1] text-white' : 'bg-[#E2DEEC] text-[#584E6B]'}`}>
                  {profile.dpiit_startup_recognised ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-[#8C82A0] leading-snug">
                Startup India turnover and prior experience relaxations for recognized tech firms.
              </p>
            </div>

            {/* GeM Registered */}
            <div
              onClick={() => setProfile({ ...profile, gem_registered: !profile.gem_registered })}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                profile.gem_registered 
                  ? 'bg-[#E6E6FA] border-[#6B46C1] text-[#1E182B] shadow-2xs' 
                  : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B] hover:bg-[#F3EFF8]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Building className={`w-4 h-4 ${profile.gem_registered ? 'text-[#6B46C1]' : 'text-[#8C82A0]'}`} />
                  <span className="text-xs font-bold">GeM Registered</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${profile.gem_registered ? 'bg-[#6B46C1] text-white' : 'bg-[#E2DEEC] text-[#584E6B]'}`}>
                  {profile.gem_registered ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-[#8C82A0] leading-snug">
                Verified seller account enabled for direct bidding on GeM BidPlus tenders.
              </p>
            </div>

            {/* Clean Record */}
            <div
              onClick={() => setProfile({ ...profile, blacklisting_status_confirmed: !profile.blacklisting_status_confirmed })}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 select-none ${
                profile.blacklisting_status_confirmed 
                  ? 'bg-[#E6E6FA] border-[#6B46C1] text-[#1E182B] shadow-2xs' 
                  : 'bg-[#FAF9FD] border-[#E2DEEC] text-[#584E6B] hover:bg-[#F3EFF8]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className={`w-4 h-4 ${profile.blacklisting_status_confirmed ? 'text-[#2E7D32]' : 'text-[#8C82A0]'}`} />
                  <span className="text-xs font-bold">Clean Record</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${profile.blacklisting_status_confirmed ? 'bg-[#2E7D32] text-white' : 'bg-[#E2DEEC] text-[#584E6B]'}`}>
                  {profile.blacklisting_status_confirmed ? 'Active' : 'Off'}
                </span>
              </div>
              <p className="text-[11px] text-[#8C82A0] leading-snug">
                Confirmed zero debarment or blacklisting across central and state authorities.
              </p>
            </div>
          </div>
        </div>

        {/* Section D: Active Certifications */}
        <div className="pt-3 border-t border-[#F0EDF7] space-y-3">
          <label className="block text-xs font-semibold text-[#1E182B]">
            Active Certifications &amp; Compliance Standards
          </label>

          {/* Quick Preset Badges */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-[#8C82A0] font-medium">Quick add:</span>
            {COMMON_CERTS.map((cert) => {
              const alreadyHas = (profile.known_certifications || []).includes(cert);
              if (alreadyHas) return null;
              return (
                <button
                  type="button"
                  key={cert}
                  onClick={() => handleAddCert(cert)}
                  className="px-2 py-0.5 rounded-md bg-[#FAF9FD] hover:bg-[#E6E6FA] text-[#584E6B] hover:text-[#1E182B] text-[11px] font-medium border border-[#E2DEEC] transition cursor-pointer"
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
              className="flex-1 px-3 py-1.5 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] text-xs font-medium text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
            />
            <button
              type="button"
              onClick={() => handleAddCert()}
              className="px-3.5 py-1.5 bg-[#E6E6FA] hover:bg-[#D8BFD8] text-[#3B2961] rounded-lg text-xs font-semibold inline-flex items-center space-x-1 cursor-pointer transition shrink-0 border border-[#D8BFD8]"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add</span>
            </button>
          </div>

          {/* Active Certifications Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {(profile.known_certifications || []).map((cert, i) => (
              <span
                key={i}
                className="inline-flex items-center space-x-1.5 text-xs bg-[#E6E6FA] border border-[#D8BFD8] px-3 py-1.5 rounded-lg font-medium text-[#3B2961] shadow-2xs"
              >
                <Award className="w-3.5 h-3.5 text-[#6B46C1]" />
                <span>{cert}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCert(cert)}
                  className="text-[#8C82A0] hover:text-rose-600 p-0.5 cursor-pointer ml-1"
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
      <div className="bg-white rounded-2xl border border-[#E2DEEC] shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-[#F0EDF7]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6E6FA] border border-[#D8BFD8] text-[#4A337A] flex items-center justify-center font-bold">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#1E182B]">
                Search Discovery Keywords ({keywords.length})
              </h3>
              <p className="text-xs text-[#8C82A0]">
                Keywords scraped continuously across GeM BidPlus, CPPP eProcurement, and State Portals
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveKeywords}
            disabled={savingKeywords}
            className="px-4 py-2 bg-[#6B46C1] hover:bg-[#553C9A] disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs inline-flex items-center space-x-1.5 transition cursor-pointer shrink-0"
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
            className="flex-1 px-3 py-1.5 rounded-lg bg-[#FAF9FD] border border-[#E2DEEC] text-xs font-medium text-[#1E182B] placeholder:text-[#8C82A0] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D8BFD8]/50 focus:border-[#6B46C1] transition"
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="px-3.5 py-1.5 bg-[#E6E6FA] hover:bg-[#D8BFD8] text-[#3B2961] rounded-lg text-xs font-semibold inline-flex items-center space-x-1 cursor-pointer transition shrink-0 border border-[#D8BFD8]"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>Add</span>
          </button>
        </div>

        {/* Keyword Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center space-x-1.5 text-xs bg-[#FAF9FD] border border-[#E2DEEC] text-[#1E182B] px-3 py-1.5 rounded-lg font-medium hover:border-[#D8BFD8] transition shadow-2xs"
            >
              <span>{kw}</span>
              <button
                onClick={() => handleRemoveKeyword(kw)}
                className="text-[#8C82A0] hover:text-rose-600 p-0.5 rounded cursor-pointer ml-0.5"
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

export default CompanySettingsView;
export { CompanySettingsView as SettingsView };
