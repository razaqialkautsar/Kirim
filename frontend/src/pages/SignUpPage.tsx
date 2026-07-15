import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import './AuthPage.css'

export function SignUpPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      await signUp(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.')
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
            <img src="/logokirimblack.png" alt="Kirim" className="auth-logo" />
            <span className="tag">TESTNET</span>
          </div>

          <div className="auth-header">
            <h1 className="heading-sm">Create Account</h1>
            <p className="auth-sub">
              Register your email. A Stellar account is created automatically, no crypto knowledge required.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="signup-email" className="form-label">Email Address</label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className="form-label">Password</label>
              <input
                id="signup-password"
                type="password"
                className="form-input"
                placeholder="At least 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-confirm" className="form-label">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                className={`form-input ${error.includes('match') ? 'error' : ''}`}
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            <button
              id="signup-submit"
              type="submit"
              className="btn-primary auth-cta"
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Creating account...</> : 'Sign Up Now'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Log In</Link>
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
