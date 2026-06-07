import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Mail, Lock, AlertCircle } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-container flex-center">
      <div className="auth-card">
        <div className="auth-header flex-center">
          <Film size={32} className="auth-logo-icon" />
          <span className="auth-logo-text">Movie Mapper</span>
        </div>
        <p className="auth-tagline">Track movies, shows, and actresses. Log your private notes.</p>

        {error && (
          <div className="alert alert-error flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label flex-center" style={{ justifyContent: 'flex-start', gap: '0.25rem' }}>
              <Mail size={14} />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label flex-center" style={{ justifyContent: 'flex-start', gap: '0.25rem' }}>
              <Lock size={14} />
              <span>Password</span>
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary auth-submit-btn">
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create one here</Link>
        </div>
      </div>

      <style>{`
        .auth-container {
          min-height: 100vh;
          width: 100%;
          background-color: var(--bg-primary);
          padding: 1.5rem;
        }
        .auth-card {
          width: 100%;
          max-width: 400px;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 2.5rem 2rem;
          box-shadow: var(--shadow-md);
        }
        .auth-header {
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .auth-logo-icon {
          color: var(--accent-color);
        }
        .auth-logo-text {
          font-size: 1.75rem;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.03em;
        }
        .auth-tagline {
          font-size: 0.875rem;
          color: var(--text-secondary);
          text-align: center;
          margin-bottom: 2rem;
          line-height: 1.4;
        }
        .auth-submit-btn {
          width: 100%;
          font-size: 0.95rem;
          font-weight: 600;
        }
        .auth-footer {
          margin-top: 1.5rem;
          text-align: center;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};

export default Login;
