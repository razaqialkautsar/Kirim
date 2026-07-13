import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './AuthPage.css'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      {/* Left: Form */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-brand">
            <span className="auth-logo">KIRIM</span>
            <span className="tag">TESTNET</span>
          </div>

          <div className="auth-header">
            <h1 className="heading-sm">Log In</h1>
            <p className="auth-sub">
              Welcome back. Log in to check your balance and send money.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">Email Address</label>
              <input
                id="login-email"
                type="email"
                className={`form-input ${error ? 'error' : ''}`}
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password" className="form-label">Password</label>
              <input
                id="login-password"
                type="password"
                className={`form-input ${error ? 'error' : ''}`}
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="btn-primary auth-cta"
              disabled={loading}
            >
              {loading ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Logging in...</> : 'Log In'}
            </button>
          </form>

          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">Sign up for free</Link>
          </p>
        </div>
      </div>

      {/* Right: Inverted panel */}
      <div className="auth-hero-panel">
        <div className="auth-hero-inner">
          <div className="auth-hero-tag tag">Kirim for Migrant Workers</div>
          <h2 className="auth-hero-heading display">
            Send<br />Money.<br />Right<br />Now.
          </h2>
          <p className="auth-hero-sub">
            One account. Send to multiple people at once. Near-zero fees.
          </p>
          <div className="auth-stats">
            <div className="auth-stat">
              <span className="auth-stat-value">{'< 10s'}</span>
              <span className="auth-stat-label">Transfer time</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat-value">~0%</span>
              <span className="auth-stat-label">Fee vs 4.8% bank fee</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
