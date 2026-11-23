import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export const AuthView = () => {
  const { login, signup } = useApp();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Sign In inputs
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up inputs (Username, Email, Password, Confirm Password)
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);

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
      setErrorMessage(getErrorMessage(err, 'Invalid username/email or password'));
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Up
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUsername = signupUsername.trim();
    const cleanEmail = signupEmail.trim();

    if (!cleanUsername) {
      setErrorMessage('Please enter a username');
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters');
      return;
    }

    if (!cleanEmail || !/\S+@\S+\.\S+/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    if (!signupPassword || signupPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage('Passwords do not match. Please verify your password.');
      return;
    }

    setLoading(true);

    try {
      await signup({
        username: cleanUsername,
        email: cleanEmail,
        password: signupPassword,
        confirm_password: signupConfirmPassword,
      });
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Registration failed. Please check your details.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9FD] flex flex-col items-center justify-center p-4 relative selection:bg-[#E6E6FA] selection:text-[#553C9A] overflow-hidden">
      
      {/* 1. Atmospheric Ambient Glow Orbs (Lavender Dream Palette) */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#E6E6FA] opacity-60 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#FFDAB9] opacity-40 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-[#D8BFD8] opacity-25 blur-3xl" />
      </div>

      {/* 2. Pure Diagonal Lines Texture Canvas Background */}
      <div className="absolute inset-0 pointer-events-none select-none opacity-80">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern 
              id="auth-lines-diagonal" 
              width="24" 
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
            {mode === 'login' ? 'Tender Tracking Portal' : 'Create an Account'}
          </h1>
          <p className="text-[#584E6B] text-xs mt-1">
            {mode === 'login' 
              ? 'Sign in using your username or registered email' 
              : 'Enter your credentials to register a new account'}
          </p>
        </div>

        {/* ERROR BANNER */}
        {errorMessage && (
          <div className="mb-4 bg-[#FFF2E5] border border-[#FFDAB9] text-[#9A3412] py-2 px-3 rounded-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#EA580C]" />
            <span className="flex-1">{errorMessage}</span>
          </div>
        )}

        {/* FORM CONTENT */}
        {mode === 'login' ? (
          /* ================= SIGN IN ================= */
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
                  placeholder="Enter username or email"
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
        ) : (
          /* ================= SIGN UP ================= */
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#1E182B] mb-1">
                Username
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-[#8C82A0] absolute left-3" />
                <input
                  type="text"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  placeholder="Choose a unique username"
                  autoComplete="username"
                  required
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] focus:bg-white focus:border-[#6B46C1] focus:ring-2 focus:ring-[#D8BFD8]/50 text-[#1E182B] text-xs sm:text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none transition placeholder:text-[#8C82A0] font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E182B] mb-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-[#8C82A0] absolute left-3" />
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] focus:bg-white focus:border-[#6B46C1] focus:ring-2 focus:ring-[#D8BFD8]/50 text-[#1E182B] text-xs sm:text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none transition placeholder:text-[#8C82A0] font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E182B] mb-1">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#8C82A0] absolute left-3" />
                <input
                  type={showSignupPassword ? 'text' : 'password'}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                  required
                  className="w-full bg-[#FAF9FD] border border-[#E2DEEC] focus:bg-white focus:border-[#6B46C1] focus:ring-2 focus:ring-[#D8BFD8]/50 text-[#1E182B] text-xs sm:text-sm rounded-lg pl-9 pr-10 py-2.5 outline-none transition placeholder:text-[#8C82A0] font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute right-3 text-[#8C82A0] hover:text-[#584E6B] transition cursor-pointer"
                  title={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E182B] mb-1">
                Verify Password
              </label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-[#8C82A0] absolute left-3" />
                <input
                  type={showSignupConfirmPassword ? 'text' : 'password'}
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  placeholder="Re-enter password to verify"
                  autoComplete="new-password"
                  required
                  className={`w-full bg-[#FAF9FD] border ${
                    signupConfirmPassword && signupPassword !== signupConfirmPassword
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                      : signupConfirmPassword && signupPassword === signupConfirmPassword
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-200'
                      : 'border-[#E2DEEC] focus:border-[#6B46C1] focus:ring-[#D8BFD8]/50'
                  } focus:bg-white focus:ring-2 text-[#1E182B] text-xs sm:text-sm rounded-lg pl-9 pr-10 py-2.5 outline-none transition placeholder:text-[#8C82A0] font-medium`}
                />
                <button
                  type="button"
                  onClick={() => setShowSignupConfirmPassword(!showSignupConfirmPassword)}
                  className="absolute right-3 text-[#8C82A0] hover:text-[#584E6B] transition cursor-pointer"
                  title={showSignupConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {signupConfirmPassword && signupPassword === signupConfirmPassword && (
                <p className="text-[11px] text-emerald-600 mt-1 flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>Passwords match</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#6B46C1] hover:bg-[#553C9A] active:bg-[#44307B] text-white font-semibold text-xs sm:text-sm rounded-lg transition shadow-md shadow-purple-900/15 cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>
        )}

        {/* SWITCH BETWEEN LOGIN & SIGNUP */}
        <div className="mt-5 text-center text-xs text-[#584E6B]">
          {mode === 'login' ? (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage('');
                }}
                className="text-[#6B46C1] hover:text-[#553C9A] font-semibold transition cursor-pointer hover:underline"
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage('');
                }}
                className="text-[#6B46C1] hover:text-[#553C9A] font-semibold transition cursor-pointer hover:underline"
              >
                Sign in
              </button>
            </span>
          )}
        </div>

      </div>

    </div>
  );
};

export default AuthView;
