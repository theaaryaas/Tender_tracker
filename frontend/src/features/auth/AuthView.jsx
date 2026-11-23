import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';

export const AuthView = () => {
  const { login } = useApp();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sign In inputs
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Helper to extract clean error message from API response
  const getErrorMessage = (err, fallback) => {
    if (err.response?.data?.detail) {
      const detail = err.response.data.detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail) && detail.length > 0) {
        return detail[0].msg || fallback;
      }
    }
    return err.message || fallback;
  };

  // Handle Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanIdentifier = loginIdentifier.trim();
    if (!cleanIdentifier) {
      setErrorMessage('Please enter your username or email address');
      return;
    }

    if (!loginPassword) {
      setErrorMessage('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      await login(cleanIdentifier, loginPassword);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Failed to sign in. Please verify your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF9FD] relative flex items-center justify-center p-4 overflow-hidden select-none">
      
      {/* 1. SOFT LAVENDER RADIAL GLOWS */}
      <div 
        className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(230, 230, 250, 0.8) 0%, rgba(216, 191, 216, 0.35) 45%, rgba(250, 249, 253, 0) 70%)',
          filter: 'blur(50px)'
        }}
      />
      <div 
        className="absolute bottom-1/4 right-1/4 translate-x-1/3 translate-y-1/3 w-[550px] h-[550px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(216, 191, 216, 0.45) 0%, rgba(230, 230, 250, 0.25) 50%, rgba(250, 249, 253, 0) 70%)',
          filter: 'blur(60px)'
        }}
      />

      {/* 2. SUBTLE ARCHITECTURAL LINE TEXTURE */}
      <div className="absolute inset-0 pointer-events-none opacity-45">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern 
              id="auth-lines-diagonal" 
              width="48" 
              height="24" 
              patternTransform="rotate(45 0 0)" 
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="24" stroke="#D1CADF" strokeWidth="1.1" strokeOpacity="0.65" />
              <line x1="12" y1="0" x2="12" y2="24" stroke="#E2DEEC" strokeWidth="0.8" strokeOpacity="0.45" />
            </pattern>
          </defs>
          <rect 
            width="100%" 
            height="100%" 
            fill="url(#auth-lines-diagonal)" 
          />
        </svg>
      </div>

      {/* 3. CENTERED CARD */}
      <div className="w-full max-w-[420px] bg-white border border-[#E2DEEC] rounded-2xl p-7 sm:p-8 shadow-xl shadow-purple-950/5 relative z-10 flex flex-col">
        
        {/* BITVIVID BRAND LOGO */}
        <div className="flex flex-col items-center justify-center">
          <img
            src="/bitvivid-brand.png"
            alt="BitVivid Solutions"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* TITLE & SUBTITLE */}
        <div className="text-center mt-4 mb-6">
          <h1 className="text-xl font-bold text-[#1E182B] tracking-tight">
            Tender Tracking & CRM Portal
          </h1>
          <p className="text-[#584E6B] text-xs mt-1">
            Sign in with your authorized corporate credentials
          </p>
        </div>

        {/* ERROR BANNER */}
        {errorMessage && (
          <div className="mb-4 bg-[#FFF2E5] border border-[#FFDAB9] text-[#9A3412] py-2 px-3 rounded-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#EA580C]" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1E182B] mb-1.5">
              Username or Email
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-[#8C82A0] absolute left-3" />
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Enter your username or email"
                autoComplete="username"
                required
                className="w-full bg-[#FAF9FD] border border-[#E2DEEC] focus:bg-white focus:border-[#6B46C1] focus:ring-2 focus:ring-[#D8BFD8]/50 text-[#1E182B] text-xs sm:text-sm rounded-lg pl-9 pr-3.5 py-2.5 outline-none transition placeholder:text-[#8C82A0] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1E182B] mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[#8C82A0] absolute left-3" />
              <input
                type={showLoginPassword ? 'text' : 'password'}
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
                className="w-full bg-[#FAF9FD] border border-[#E2DEEC] focus:bg-white focus:border-[#6B46C1] focus:ring-2 focus:ring-[#D8BFD8]/50 text-[#1E182B] text-xs sm:text-sm rounded-lg pl-9 pr-10 py-2.5 outline-none transition placeholder:text-[#8C82A0] font-medium"
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                className="absolute right-3 text-[#8C82A0] hover:text-[#584E6B] transition cursor-pointer"
                title={showLoginPassword ? 'Hide password' : 'Show password'}
              >
                {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] text-white font-semibold text-xs sm:text-sm rounded-lg transition shadow-md shadow-purple-900/15 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* SECURITY & RBAC ADVISORY NOTE */}
        <div className="mt-6 pt-4 border-t border-[#E2DEEC] flex items-start space-x-2 text-[11px] text-[#584E6B] leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-[#6B46C1] shrink-0 mt-0.5" />
          <span>
            <strong>Authorized Access Only.</strong> User accounts and role permissions are provisioned by your Manager or System Administrator.
          </span>
        </div>

      </div>

      {/* FOOTER METADATA */}
      <div className="absolute bottom-4 text-center text-xs text-[#8C82A0] pointer-events-none">
        BitVivid Solutions Private Limited &bull; Public Procurement & Bidding Intelligence
      </div>
    </div>
  );
};
