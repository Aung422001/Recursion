import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/Button';
import { AuthShell, FormError } from './AuthShell';
import { LANGUAGE_CODES } from 'shared/constants.js';
import { languageLabel } from '../components/LanguageBadge';

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    password: '',
    sourceLang: 'en',
    targetLang: 'th',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (form.sourceLang === form.targetLang) {
      setError('Pick two different languages');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message ?? 'Could not create your account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Pick a language and start in about ten seconds.">
      <form onSubmit={onSubmit} noValidate>
        <FormError error={error} />

        <label className="label" htmlFor="displayName">
          Name
        </label>
        <input
          id="displayName"
          className="input"
          autoComplete="name"
          required
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
        />

        <label className="label mt-4" htmlFor="email">
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
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby="password-hint"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <p id="password-hint" className="mt-1 text-xs text-slate-500">
          At least 8 characters.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sourceLang">
              I speak
            </label>
            <select
              id="sourceLang"
              className="input"
              value={form.sourceLang}
              onChange={(e) => setForm({ ...form, sourceLang: e.target.value })}
            >
              {LANGUAGE_CODES.map((code) => (
                <option key={code} value={code} disabled={code === form.targetLang}>
                  {languageLabel(code)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="targetLang">
              I want to learn
            </label>
            <select
              id="targetLang"
              className="input"
              value={form.targetLang}
              onChange={(e) => setForm({ ...form, targetLang: e.target.value })}
            >
              {LANGUAGE_CODES.map((code) => (
                <option key={code} value={code} disabled={code === form.sourceLang}>
                  {languageLabel(code)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">You can change or add courses at any time.</p>

        <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>
          Start learning
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
