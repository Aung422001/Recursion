import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../pages/Login';
import { AuthContext } from '../context/AuthContext';
import { ProtectedRoute } from '../routes/ProtectedRoute';

function renderLogin(auth = {}) {
  const value = { user: null, loading: false, login: vi.fn(), ...auth };
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<div>Unit map</div>} />
          <Route path="/signup" element={<div>Signup page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
  return value;
}

describe('login page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits the credentials that were typed', async () => {
    const user = userEvent.setup();
    const auth = renderLogin({ login: vi.fn().mockResolvedValue(undefined) });

    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(auth.login).toHaveBeenCalledWith('learner@example.com', 'correct-horse-battery');
  });

  it('shows the server error when the credentials are rejected', async () => {
    const user = userEvent.setup();
    renderLogin({ login: vi.fn().mockRejectedValue(new Error('Invalid email or password')) });

    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('navigates into the app on success', async () => {
    const user = userEvent.setup();
    renderLogin({ login: vi.fn().mockResolvedValue(undefined) });

    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Unit map')).toBeInTheDocument();
  });

  it('uses a password field so the value is masked', () => {
    renderLogin();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('offers a route to sign up', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup'
    );
  });
});

describe('ProtectedRoute', () => {
  const renderGuarded = (auth) =>
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/secret']}>
          <Routes>
            <Route
              path="/secret"
              element={
                <ProtectedRoute>
                  <div>Secret content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

  it('waits for the silent refresh instead of flashing the login page', () => {
    renderGuarded({ user: null, loading: true });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('redirects an anonymous visitor to login', () => {
    renderGuarded({ user: null, loading: false });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the page for a logged-in learner', () => {
    renderGuarded({ user: { displayName: 'Aung' }, loading: false });
    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });
});
