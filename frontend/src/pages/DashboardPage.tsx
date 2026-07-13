import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { kirimApi, getSocket } from '../lib/api'
import type { DashboardData, RecipientInput, SavingsPosition } from '../lib/api'
import { IconAffiliate, IconPigMoney, IconHistory, IconBuildingBank, IconZzz } from '@tabler/icons-react';
import './DashboardPage.css'

type Tab = 'kirim' | 'cairkan' | 'tabungan' | 'riwayat'
type Icon = "icon-affiliate" | "icon-pig-money" | "icon-history" | "icon-building-bank"
// ─── Toast Notification ───────────────────────────────────────────────────
interface Toast {
  id: number
  message: string
  type: 'success' | 'info' | 'bonus'
}

function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} role="alert">
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => onClose(t.id)} aria-label="Close">×</button>
        </div>
      ))}
    </div>
  )
}

// ─── Recipient Slot ───────────────────────────────────────────────────────
interface Slot { address: string; bps: number }

function RecipientSlot({
  index, slot, onChange, onRemove, canRemove,
}: {
  index: number
  slot: Slot
  onChange: (s: Slot) => void
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <div className="recipient-slot">
      <div className="recipient-slot-header">
        <span className="mono" style={{ color: 'var(--color-smoke)' }}>Recipient {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            className="recipient-remove"
            onClick={onRemove}
            aria-label="Remove recipient"
          >×</button>
        )}
      </div>
      <div className="form-group">
        <label className="form-label">Stellar Address</label>
        <input
          type="text"
          className="form-input"
          placeholder="GABC...XYZ"
          value={slot.address}
          onChange={e => onChange({ ...slot, address: e.target.value })}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
        />
      </div>
      <div className="form-group">
        <label className="form-label">Portion (%)</label>
        <div className="bps-row">
          <input
            type="range"
            min={0}
            max={10000}
            step={100}
            value={slot.bps}
            onChange={e => onChange({ ...slot, bps: Number(e.target.value) })}
            className="bps-slider"
          />
          <span className="bps-value">{(slot.bps / 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Transaction Row ──────────────────────────────────────────────────────
function TransactionRow({ tx }: { tx: DashboardData['history'][0] }) {
  const [expanded, setExpanded] = useState(false)

  const typeLabel: Record<string, string> = {
    onramp: 'Top Up',
    disbursement: 'Send',
    offramp: 'Withdraw',
  }

  // Support both camelCase (backend) and snake_case (legacy)
  const txType = (tx as any).txType ?? (tx as any).tx_type
  const totalAmount = (tx as any).totalAmount ?? (tx as any).total_amount
  const createdAt = (tx as any).createdAt ?? (tx as any).created_at
  const stellarTxHash = (tx as any).stellarTxHash ?? (tx as any).stellar_tx_hash

  const statusEl = (
    <span className={`status-${tx.status}`}>
      {tx.status === 'completed' ? 'Completed' : tx.status === 'pending' ? 'Processing' : 'Failed'}
    </span>
  )

  return (
    <div className={`tx-row ${expanded ? 'expanded' : ''}`}>
      <div
        className="tx-row-main"
        onClick={() => txType === 'disbursement' && setExpanded(e => !e)}
        style={{ cursor: txType === 'disbursement' ? 'pointer' : 'default' }}
      >
        <div className="tx-type-badge">{typeLabel[txType] ?? txType}</div>
        <div className="tx-amount">{Number(totalAmount).toFixed(2)} TESTUSD</div>
        <div className="tx-date">{new Date(createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
        <div>{statusEl}</div>
        {stellarTxHash && (
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${stellarTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="tx-hash mono"
            onClick={e => e.stopPropagation()}
          >
            {stellarTxHash.slice(0, 8)}…
          </a>
        )}
        {txType === 'disbursement' && (
          <span className="tx-expand-icon">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && tx.recipients && (
        <div className="tx-recipients">
          {tx.recipients.map((r, i) => {
            const addr = (r as any).receiverStellarAddress ?? (r as any).stellar_address ?? ''
            const bps = (r as any).percentageBps ?? (r as any).percentage_bps ?? 0
            return (
              <div key={i} className="tx-recipient-row">
                <span className="mono tx-recipient-addr">{addr.slice(0, 6)}…{addr.slice(-4)}</span>
                <span>{(bps / 100).toFixed(0)}%</span>
                <span>{r.amount.toFixed(2)} TESTUSD</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Kirim ────────────────────────────────────────────────────────────
function KirimTab({ onSuccess }: { onSuccess: () => void }) {
  const [slots, setSlots] = useState<Slot[]>([{ address: '', bps: 10000 }])
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const totalBps = slots.reduce((s, r) => s + r.bps, 0)
  const isValid = totalBps === 10000 && slots.every(r => r.address.startsWith('G') && r.address.length === 56) && Number(amount) > 0

  function addRecipient() {
    if (slots.length >= 5) return
    setSlots(s => [...s, { address: '', bps: 0 }])
  }

  function updateSlot(i: number, s: Slot) {
    setSlots(prev => prev.map((r, idx) => idx === i ? s : r))
  }

  function removeSlot(i: number) {
    setSlots(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (totalBps !== 10000) {
      setError(`Total portion must be 100%. Currently: ${(totalBps / 100).toFixed(0)}%`)
      return
    }

    setLoading(true)
    try {
      const recipients: RecipientInput[] = slots.map(s => ({
        stellarAddress: s.address,
        percentageBps: s.bps,
      }))

      const res = await kirimApi.send(recipients, amount)
      setSuccess(`Sent successfully! Hash: ${res.stellarTxHash?.slice(0, 12)}…`)

      setSlots([{ address: '', bps: 10000 }])
      setAmount('')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tab-form">
      <div className="form-group">
        <label htmlFor="kirim-amount" className="form-label">Amount (TESTUSD)</label>
        <input
          id="kirim-amount"
          type="number"
          min="0.01"
          step="0.01"
          className="form-input"
          placeholder="Example: 100"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="recipients-section">
        <div className="recipients-header">
          <span className="form-label">Recipient</span>
          <span className={`bps-total mono ${totalBps !== 10000 ? 'bps-total-error' : 'bps-total-ok'}`}>
            Total: {(totalBps / 100).toFixed(0)}% {totalBps === 10000 ? '✓' : `(missing ${((10000 - totalBps) / 100).toFixed(0)}%)`}
          </span>
        </div>

        {slots.map((slot, i) => (
          <RecipientSlot
            key={i}
            index={i}
            slot={slot}
            onChange={s => updateSlot(i, s)}
            onRemove={() => removeSlot(i)}
            canRemove={slots.length > 1}
          />
        ))}

        {slots.length < 5 && (
          <button type="button" className="btn-ghost add-recipient-btn" onClick={addRecipient}>
            + Add Recipient
          </button>
        )}
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}
      {success && <div className="success-msg" role="status">{success}</div>}

      {loading && (
        <div className="soroban-loading-hint">
          <span className="spinner" style={{ borderTopColor: 'var(--color-mint)' }} />
          <span>Waiting for Soroban blockchain confirmation (3–10 seconds)…</span>
        </div>
      )}

      <button
        id="kirim-submit"
        type="submit"
        className="btn-primary"
        disabled={loading || !isValid}
      >
        {loading ? <>Sending...</> : 'Send Now'}
      </button>
    </form>
  )
}

// ─── Tab: Cairkan ─────────────────────────────────────────────────────────
// Bank yang didukung sesuai API docs backend
const BANKS = [
  { code: 'BCA', label: 'BCA' },
  { code: 'BNI', label: 'BNI' },
  { code: 'BRI', label: 'BRI' },
  { code: 'MANDIRI', label: 'Mandiri' },
  { code: 'PERMATA', label: 'Permata' },
]

function CairkanTab({ onSuccess }: { onSuccess: () => void }) {
  const [amountUSD, setAmountUSD] = useState('')
  const [bankCode, setBankCode] = useState('BCA')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountName, setAccountName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const idrEstimate = amountUSD ? (Number(amountUSD) * 15800).toLocaleString('id-ID') : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await kirimApi.offramp({
        bankCode,
        accountNumber,
        accountName,
        amountTESTUSD: Number(amountUSD),
      })
      const idrFormatted = res.data.amountIDR.toLocaleString('id-ID')
      setSuccess(`${res.message} Funds ≈ Rp ${idrFormatted} will be transferred to your account.`)

      setAmountUSD('')
      setAccountNumber('')
      setAccountName('')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tab-form">
      <div className="form-group">
        <label htmlFor="cairkan-amount" className="form-label">Withdraw Amount (TESTUSD)</label>
        <input
          id="cairkan-amount"
          type="number"
          min="1"
          step="0.01"
          className="form-input"
          placeholder="Example: 50"
          value={amountUSD}
          onChange={e => setAmountUSD(e.target.value)}
          required
        />
        {idrEstimate && (
          <span className="form-hint">≈ Rp {idrEstimate} (est. rate Rp15,800)</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="cairkan-bank" className="form-label">Withdrawal Destination</label>
        <select
          id="cairkan-bank"
          className="form-input"
          value={bankCode}
          onChange={e => setBankCode(e.target.value)}
        >
          {BANKS.map(b => <option key={b.code} value={b.code}>{b.label}</option>)}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="cairkan-accnum" className="form-label">Account Number</label>
        <input
          id="cairkan-accnum"
          type="text"
          className="form-input"
          placeholder="Account number"
          value={accountNumber}
          onChange={e => setAccountNumber(e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="cairkan-accname" className="form-label">Account Holder Name</label>
        <input
          id="cairkan-accname"
          type="text"
          className="form-input"
          placeholder="As on bank account"
          value={accountName}
          onChange={e => setAccountName(e.target.value)}
          required
        />
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}
      {success && <div className="success-msg" role="status">{success}</div>}

      <button
        id="cairkan-submit"
        type="submit"
        className="btn-primary"
        disabled={loading}
      >
        {loading ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Processing...</> : 'Withdraw Funds'}
      </button>
    </form>
  )
}

// ─── Tab: Tabungan Blend ──────────────────────────────────────────────────
function TabunganTab({ addToast }: { addToast: (msg: string, type: Toast['type']) => void }) {
  const [position, setPosition] = useState<SavingsPosition | null>(null)
  const [loadingPos, setLoadingPos] = useState(true)
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [depositing, setDepositing] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSavings = useCallback(async () => {
    try {
      const res = await kirimApi.getSavings()
      setPosition(res.data)
    } catch (err) {
      console.warn('[savings] polling error:', err)
    } finally {
      setLoadingPos(false)
    }
  }, [])

  useEffect(() => {
    fetchSavings()
    // Polling setiap 2 detik untuk animasi yield naik
    pollingRef.current = setInterval(fetchSavings, 2000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchSavings])

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDepositing(true)
    try {
      const res = await kirimApi.depositToSavings(Number(depositAmount))
      addToast(`✅ Deposit ${depositAmount} TESTUSD to Blend successful!`, 'success')
      setDepositAmount('')
      // Force refresh
      await fetchSavings()
      console.log('[savings] deposit berhasil:', res.data.stellarTxHash)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed.')
    } finally {
      setDepositing(false)
    }
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setWithdrawing(true)
    try {
      await kirimApi.withdrawFromSavings(Number(withdrawAmount))
      addToast(`💰 Withdrawal of ${withdrawAmount} TESTUSD successful!`, 'info')
      setWithdrawAmount('')
      await fetchSavings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed.')
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <div className="tab-form">
      {/* ─ Header Badge ─ */}
      {/* <div className="blend-header">
        <div className="blend-badge">
          <span className="blend-dot" />
          <span>Blend Protocol — On-Chain</span>
        </div>
        <div className="blend-apy">
          APY <strong>{position?.apyPercentage ?? 8.5}%</strong>
        </div>
      </div> */}

      {/* ─ Posisi Tabungan ─ */}
      {loadingPos ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <span className="spinner" />
        </div>
      ) : position ? (
        <div className="savings-position-card">
          <div className="savings-row">
            <span className="form-label">Deposited Capital</span>
            <span className="mono">{position.amountDeposited.toFixed(2)} TESTUSD</span>
          </div>
          <div className="savings-row savings-row-highlight">
            <span className="form-label">Current Value</span>
            <span className="mono savings-current-value">
              {position.currentValue.toFixed(7)} TESTUSD
            </span>
          </div>
          <div className="savings-row">
            <span className="form-label">Yield Earned</span>
            <span className="mono stat-highlight">
              +{position.yieldEarned.toFixed(7)} TESTUSD
            </span>
          </div>
          <div className="savings-row">
            <span className="form-label">Started Saving</span>
            <span className="mono">{new Date(position.depositedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="savings-onchain-badge">
            ✅ Verified On-Chain on Blend Protocol
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p className='empty-state__main'>
            <IconZzz />
             No active savings.
          </p>
          <p className="form-hint">Deposit TESTUSD/USDC to Blend and earn <strong>8.5% APY</strong></p>
        </div>
      )}

      {error && <div className="auth-error" role="alert">{error}</div>}

      {/* ─ Form Deposit ─ */}
      <form onSubmit={handleDeposit} className="savings-action-form">
        <div className="form-group">
          <label htmlFor="savings-deposit-amount" className="form-label">Deposit to Blend</label>
          <div className="topup-row">
            <input
              id="savings-deposit-amount"
              type="number"
              min="1"
              step="0.01"
              className="form-input"
              placeholder="TESTUSD/USDC Amount"
              value={depositAmount}
              onChange={e => setDepositAmount(e.target.value)}
              required
              style={{ flex: 1 }}
            />
            <button
              id="savings-deposit-submit"
              type="submit"
              className="btn-mint"
              disabled={depositing || !depositAmount}
              style={{ whiteSpace: 'nowrap' }}
            >
              {depositing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving...</> : 'Deposit'}
            </button>
          </div>
          {depositing && (
            <p className="form-hint" style={{ marginTop: 6 }}>
              ⏳ Waiting for Soroban confirmation (3–10 seconds)…
            </p>
          )}
        </div>
      </form>

      {/* ─ Form Withdraw (hanya tampil jika ada posisi) ─ */}
      {position && (
        <form onSubmit={handleWithdraw} className="savings-action-form">
          <div className="form-group">
            <label htmlFor="savings-withdraw-amount" className="form-label">Withdraw Savings</label>
            <div className="topup-row">
              <input
                id="savings-withdraw-amount"
                type="number"
                min="0.01"
                max={position.amountDeposited}
                step="0.01"
                className="form-input"
                placeholder={`Max ${position.amountDeposited.toFixed(2)} TESTUSD`}
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                required
                style={{ flex: 1 }}
              />
              <button
                id="savings-withdraw-submit"
                type="submit"
                className="btn-ghost"
                disabled={withdrawing || !withdrawAmount}
                style={{ whiteSpace: 'nowrap' }}
              >
                {withdrawing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Withdrawing...</> : 'Withdraw'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Tab: Riwayat ─────────────────────────────────────────────────────────
function RiwayatTab({ history }: { history: DashboardData['history'] }) {
  if (history.length === 0) {
    return (
      <div className="empty-state">
        <p>No transactions yet.</p>
        <p className="form-hint">Start by topping up or sending to a recipient.</p>
      </div>
    )
  }

  return (
    <div className="tx-list">
      {history.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────
export function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('riwayat')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [copied, setCopied] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  function addToast(message: string, type: Toast['type'] = 'success') {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000)
  }

  function closeToast(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await kirimApi.getDashboard()
      if (res.data) {
        setData(res.data)
        setFetchError('')
        // Jika wallet belum ada, provision otomatis
        if (!res.data.wallet) {
          try {
            await kirimApi.provisionWallet()
            // Fetch ulang setelah provision
            const res2 = await kirimApi.getDashboard()
            if (res2.data) setData(res2.data)
          } catch {
            console.warn('[dashboard] Wallet provision gagal')
          }
        }
      } else {
        setFetchError('Data dashboard tidak lengkap dari server.')
      }
    } catch (err) {
      setFetchError(err instanceof Error ? `Gagal terhubung ke server: ${err.message}` : 'Gagal terhubung ke server.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  // ─── WebSocket event listeners ─────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleOnrampCompleted = (d: { amountMYR: number; amountTESTUSD: string; bonusUSDC: string }) => {
      addToast(`💵 Top-up successful! ${d.amountTESTUSD} TESTUSD added to your wallet.`, 'success')
      if (parseFloat(d.bonusUSDC) > 0) {
        setTimeout(() => addToast(`🎁 Free ${d.bonusUSDC} USDC bonus received! Try the Blend Savings feature.`, 'bonus'), 1000)
      }
      fetchDashboard()
    }

    const handleTxCompleted = (d: { totalAmount: number }) => {
      addToast(`✅ Transfer of ${d.totalAmount} TESTUSD successfully confirmed on-chain!`, 'success')
      fetchDashboard()
    }

    const handleTxReceived = (d: { amount: number }) => {
      addToast(`📩 You received ${d.amount} TESTUSD from sender!`, 'info')
      fetchDashboard()
    }

    const handleOfframpCompleted = (d: { amountIDR: number; bankCode: string }) => {
      addToast(`🏦 Withdrawal to ${d.bankCode} successful! Rp ${d.amountIDR.toLocaleString('id-ID')} is processing.`, 'success')
      fetchDashboard()
    }

    const handleSavingsDeposited = (d: { totalDeposited: number }) => {
      addToast(`🌱 Deposit of ${d.totalDeposited} TESTUSD to Blend confirmed on-chain!`, 'success')
    }

    socket.on('onramp:completed', handleOnrampCompleted)
    socket.on('transaction:completed', handleTxCompleted)
    socket.on('transaction:received', handleTxReceived)
    socket.on('offramp:completed', handleOfframpCompleted)
    socket.on('savings:deposited', handleSavingsDeposited)

    return () => {
      socket.off('onramp:completed', handleOnrampCompleted)
      socket.off('transaction:completed', handleTxCompleted)
      socket.off('transaction:received', handleTxReceived)
      socket.off('offramp:completed', handleOfframpCompleted)
      socket.off('savings:deposited', handleSavingsDeposited)
    }
  }, [fetchDashboard])

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  function copyAddress() {
    if (!data?.wallet?.stellarAddress) return
    navigator.clipboard.writeText(data.wallet.stellarAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Hitung balance estimasi dari metrics
  const balance = data?.metrics
    ? (data.metrics.totalOnRampMYR * 0.22 - data.metrics.totalDisbursedUSD - data.metrics.totalOffRampIDR / 15800).toFixed(2)
    : '–'

  return (
    <div className="dashboard-layout">
      {/* ─── Toast Notifications ─ */}
      <ToastContainer toasts={toasts} onClose={closeToast} />

      {/* ── Top Nav ── */}
      <nav className="dashboard-nav">
        <span className="dashboard-brand">KIRIM</span>
        <div className="dashboard-nav-right">
          <span className="dashboard-user mono">{user?.email}</span>
          <button id="logout-btn" className="btn-ghost" onClick={handleLogout}>Log Out</button>
        </div>
      </nav>

      <div className="dashboard-body">
        {/* ── Sidebar ── */}
        <aside className="dashboard-sidebar">
          <div className="card sidebar-balance-card">
            <div className="form-label">TESTUSD Balance</div>
            {loadingData ? (
              <span className="spinner" style={{ margin: '8px 0' }} />
            ) : (
              <div className="sidebar-balance">
                {balance}
                <span className="sidebar-balance-unit">TESTUSD</span>
              </div>
            )}
          </div>

          {data?.wallet?.stellarAddress && (
            <div className="card sidebar-addr-card">
              <div className="form-label">Stellar Address</div>
              <div className="stellar-addr">
                <span className="mono stellar-addr-text">
                  {data.wallet.stellarAddress.slice(0, 6)}…{data.wallet.stellarAddress.slice(-4)}
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={copyAddress}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {data?.metrics && (
            <div className="card sidebar-stats-card">
              <div className="stat-row">
                <span className="form-label">Successful Transactions</span>
                <span className="mono">{data.metrics.totalTransactions}</span>
              </div>
              <div className="stat-row">
                <span className="form-label">Total Saved</span>
                <span className="mono stat-highlight">
                  ${data.metrics.totalSavedUSD.toFixed(2)}
                </span>
              </div>
              {/* <div className="stat-row">
                <span className="form-label">vs Bank Tradisional</span>
                <span className="mono">{data.metrics.traditionalFeePercent}%</span>
              </div> */}
              <div className="stat-row">
                <span className="form-label">Transfer Fee</span>
                <span className="mono stat-highlight">{data.metrics.kirimFeePercent}%</span>
              </div>
            </div>
          )}

          {/* Top Up quick action */}
          <div className="card sidebar-onramp-card">
            <TopUpMini onSuccess={fetchDashboard} addToast={addToast} />
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="dashboard-main">
          {/* Tab nav */}
          <div className="tab-nav">
            {(['kirim', 'cairkan', 'tabungan', 'riwayat'] as Tab[]).map(t => (
              <button
                key={t}
                id={`tab-${t}`}
                className={`tab-btn ${tab === t ? 'active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'kirim' ?  <IconAffiliate size={22}/>
                  : t === 'cairkan' ? <IconBuildingBank size={22}/>
                  : t === 'tabungan' ? <IconPigMoney size={22} />
                  : <IconHistory size={22} />}
                {t === 'kirim' ?  'Send'
                  : t === 'cairkan' ? 'Withdraw'
                  : t === 'tabungan' ? 'Savings'
                  : 'History'}
              </button>
            ))}
          </div>

          <div className="tab-panel card">
            {fetchError && (
              <div className="auth-error" style={{ marginBottom: 16 }}>{fetchError}</div>
            )}

            {tab === 'kirim' && <KirimTab onSuccess={fetchDashboard} />}
            {tab === 'cairkan' && <CairkanTab onSuccess={fetchDashboard} />}
            {tab === 'tabungan' && <TabunganTab addToast={addToast} />}
            {tab === 'riwayat' && (
              loadingData
                ? <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>
                : <RiwayatTab history={data?.history ?? []} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Top Up Mini (sidebar) ───────────────────────────────────────────────
function TopUpMini({ onSuccess, addToast }: { onSuccess: () => void; addToast: (msg: string, type: Toast['type']) => void }) {
  const [amountMYR, setAmountMYR] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleTopUp(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setLoading(true)
    try {
      const res = await kirimApi.onramp(Number(amountMYR))
      const usdAmt = parseFloat(res.amountTESTUSD).toFixed(2)
      setMsg(`✓ ${usdAmt} TESTUSD received`)

      if (parseFloat(res.bonusUSDC) > 0) {
        addToast(`🎁 Free ${res.bonusUSDC} USDC bonus received! Try the Blend Savings feature.`, 'bonus')
      }

      setAmountMYR('')
      onSuccess()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Top up failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleTopUp} className="topup-mini">
      <div className="form-label">Top Up (MYR → TESTUSD)</div>
      <div className="topup-row">
        <input
          id="topup-amount"
          type="number"
          min="1"
          className="form-input"
          placeholder="MYR Amount"
          value={amountMYR}
          onChange={e => setAmountMYR(e.target.value)}
          required
          style={{ flex: 1 }}
        />
        <button
          id="topup-submit"
          type="submit"
          className="btn-mint"
          disabled={loading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Top Up'}
        </button>
      </div>
      {amountMYR && (
        <p className="form-hint topup-preview">
          ≈ {(Number(amountMYR) * 0.22).toFixed(2)} TESTUSD (est. rate 0.22)
        </p>
      )}
      {msg && (
        <p className="topup-msg mono">
          {msg}
        </p>
      )}
    </form>
  )
}
