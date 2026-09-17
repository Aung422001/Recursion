import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { AuthShell, FormError } from './AuthShell';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.message ?? 'Could not log in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Pick up where you left off.">
      <form onSubmit={onSubmit} noValidate>
        <FormError error={error} />

        <label className="label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <label className="label mt-4" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
          Log in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-emerald-700 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
