import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const { setAuth, token }      = useAuthStore();
  const navigate                = useNavigate();

  if (token) { navigate('/'); return null; }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.token, data.user);
      toast.success(`Welcome back, ${data.user.nama}`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none grid-overlay" />

      {/* Ambient gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]
                      bg-primary-container/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Login bento cell */}
      <main className="relative z-10 w-full max-w-md px-4 md:px-0">
        <div className="card ambient-glow p-8 flex flex-col gap-8">

          {/* Brand */}
          <div className="text-center flex flex-col gap-2">
            <h1 className="text-headline-lg font-headline-lg text-primary-fixed-dim tracking-tight">
              CFC
            </h1>
            <p className="text-mono-label font-mono-label text-text-muted uppercase tracking-widest">
              Culling Foto Creative · Pro Workspace
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-label-sm font-label-sm text-text-muted uppercase" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2
                                 text-text-muted pointer-events-none" style={{fontSize:18}}>mail</span>
                <input
                  id="email" type="email" required
                  className="input pl-10"
                  placeholder="photographer@studio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-label-sm font-label-sm text-text-muted uppercase" htmlFor="password">
                  Password
                </label>
                <button type="button" className="text-mono-label font-mono-label text-on-surface-variant
                                                  hover:text-primary transition-colors">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2
                                 text-text-muted pointer-events-none" style={{fontSize:18}}>lock</span>
                <input
                  id="password" type={showPw ? 'text' : 'password'} required
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined" style={{fontSize:16}}>
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-col gap-3">
              <button type="submit" disabled={loading}
                className="btn-primary w-full justify-center py-3">
                {loading ? 'Signing in…' : 'Sign in as Photographer'}
                {!loading && (
                  <span className="material-symbols-outlined" style={{fontSize:18}}>arrow_forward</span>
                )}
              </button>
              <button type="button"
                className="btn-secondary w-full justify-center py-3">
                Request Client Access
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="text-center border-t border-border-dark pt-4">
            <p className="text-mono-label font-mono-label text-text-muted">
              Secured by CFC Core
            </p>
            <p className="text-mono-label font-mono-label text-text-muted/50 mt-1">
              Demo: fotografer@demo.com / password123
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
