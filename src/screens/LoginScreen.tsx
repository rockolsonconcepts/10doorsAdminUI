import { FormEvent, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { Button, ErrorNote, inputClass } from '@/components/ui';

export function LoginScreen() {
  const { state, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(state.status === 'signed-out' ? state.error ?? null : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === 'signed-out' && state.error) setError(state.error);
  }, [state]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-card dark:border-white/10 dark:bg-[#16161D]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600" />
          <h1 className="text-lg font-semibold">10Doors Admin</h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">Platform administrators only.</p>
        <ErrorNote message={error} />
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600 dark:text-slate-300">Email</span>
          <input className={inputClass} type="email" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600 dark:text-slate-300">Password</span>
          <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <Button type="submit" className="w-full justify-center" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
