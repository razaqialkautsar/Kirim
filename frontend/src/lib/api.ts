// Centralized API client untuk backend Kirim (port 3001)
// Semua request ke backend wajib lewat sini agar token otomatis terlampir

import { io, Socket } from 'socket.io-client'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

// ─── Token Helpers ────────────────────────────────────────────────────────
function getToken(): string | null {
  return localStorage.getItem('kirim_token')
}

export function setToken(token: string): void {
  localStorage.setItem('kirim_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('kirim_token')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

// ─── Generic Request Helper ───────────────────────────────────────────────
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.message ?? `HTTP ${res.status}`)
  }

  return data as T
}

const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

// ─── Typed Interfaces ─────────────────────────────────────────────────────

export interface DashboardData {
  wallet: { stellarAddress: string } | null
  metrics: {
    totalTransactions: number
    totalOnRampMYR: number
    totalDisbursedUSD: number
    totalOffRampIDR: number
    totalSavedUSD: number
    traditionalFeePercent: number
    kirimFeePercent: number
  }
  history: TransactionRecord[]
}

export interface TransactionRecord {
  id: string
  txType: 'onramp' | 'disbursement' | 'offramp'
  totalAmount: number
  exchangeRate?: number
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  stellarTxHash?: string
  recipients?: {
    receiverStellarAddress: string
    percentageBps: number
    amount: number
  }[]
}

export interface RecipientInput {
  stellarAddress: string
  percentageBps: number
}

export interface SavingsPosition {
  userId: string
  amountDeposited: number
  currentValue: number
  yieldEarned: number
  apyPercentage: number
  depositedAt: string
  onChain: boolean
}

// ─── API Helpers ──────────────────────────────────────────────────────────

export const kirimApi = {
  /** Fetch semua data dashboard (wallet, metrics, history) */
  getDashboard: () => api.get<{ data: DashboardData }>('/api/dashboard'),

  /** Provision akun Stellar untuk user baru (idempotent) */
  provisionWallet: () =>
    api.post<{ message: string; stellar_public_key: string }>(
      '/api/wallets/provision',
      {}
    ),

  /** Simulasi on-ramp: deposit MYR → TESTUSD */
  onramp: (amountMYR: number) =>
    api.post<{
      transactionId: string
      stellarTxHash: string
      amountMYR: number
      amountTESTUSD: string
      bonusUSDC: string
      exchangeRate: number
      recipientStellarAddress: string
    }>('/api/onramp/simulate', { amountMYR }),

  /** Kirim split payment ke beberapa penerima */
  send: (recipients: RecipientInput[], totalAmountTestusd: string) =>
    api.post<{ transactionId: string; stellarTxHash: string; status: string }>(
      '/api/transactions/send',
      { recipients, totalAmountTestusd }
    ),

  /** Cairkan TESTUSD ke rekening bank */
  offramp: (payload: {
    bankCode: string
    accountNumber: string
    accountName: string
    amountTESTUSD: number
  }) =>
    api.post<{
      message: string
      data: {
        transactionId: string
        stellarTxHash: string | null
        amountTESTUSD: number
        amountIDR: number
        exchangeRate: number
        bankCode: string
        accountNumber: string
        accountName: string
        status: string
      }
    }>('/api/offramp/submit-bank', payload),

  /** Deposit ke tabungan Blend on-chain */
  depositToSavings: (amount: number) =>
    api.post<{ message: string; data: { totalDeposited: number; stellarTxHash: string } }>(
      '/api/savings/deposit',
      { amount }
    ),

  /** Tarik dari tabungan */
  withdrawFromSavings: (amount: number) =>
    api.post<{ message: string; data: { remainingDeposit: number } }>(
      '/api/savings/withdraw',
      { amount }
    ),

  /** Cek posisi tabungan + yield real-time */
  getSavings: () =>
    api.get<{ message: string; data: SavingsPosition | null }>('/api/savings'),
}

// ─── WebSocket (Socket.io) ────────────────────────────────────────────────

let _socket: Socket | null = null

export function getSocket(): Socket | null {
  return _socket
}

export function connectSocket(token: string): Socket {
  if (_socket?.connected) return _socket

  _socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  })

  _socket.on('connect', () => {
    console.log('[socket] Terhubung ke server notifikasi!')
  })

  _socket.on('disconnect', () => {
    console.log('[socket] Terputus dari server.')
  })

  _socket.on('connect_error', (err) => {
    console.warn('[socket] Gagal konek:', err.message)
  })

  return _socket
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}
