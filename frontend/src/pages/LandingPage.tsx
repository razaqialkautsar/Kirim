import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingPage.css'

// ── Intersection Observer hook for scroll-in animations ────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

// ── Animated counter ────────────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = '', prefix = '', duration = 1600 }: {
  target: number; suffix?: string; prefix?: string; duration?: number
}) {
  const [value, setValue] = useState(0)
  const { ref, inView } = useInView()

  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setValue(target); clearInterval(timer) }
      else setValue(Math.floor(start))
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target, duration])

  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>}>
      {prefix}{value.toLocaleString('id-ID')}{suffix}
    </span>
  )
}

// ── Nav ─────────────────────────────────────────────────────────────────────
function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`landing-nav ${scrolled ? 'landing-nav--scrolled' : ''}`} aria-label="Navigasi utama">
      <div className="landing-nav__inner">
        <span className="landing-nav__brand" aria-label="Kirim">KIRIM</span>
        <div className="landing-nav__links">
          <a href="#how" className="landing-nav__link">Cara Kerja</a>
          <a href="#features" className="landing-nav__link">Fitur</a>
          <Link to="/login" className="btn-ghost landing-nav__btn">Masuk</Link>
          <Link to="/signup" className="btn-primary landing-nav__btn">Daftar Gratis</Link>
        </div>
      </div>
    </nav>
  )
}

// ── Section 1: Hero ─────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="hero" id="hero" aria-labelledby="hero-heading">
      <div className="page-container hero__inner">
        {/* Eyebrow */}
        <span className="tag tag-yellow hero__eyebrow">
          ✦ Stellar Blockchain · Malaysia → Indonesia
        </span>

        {/* Headline */}
        <h1 id="hero-heading" className="display hero__headline">
          Kirim <br />
          <span className="hero__headline-mint">Uang</span><br />
          Tanpa Riba Biaya
        </h1>

        <p className="hero__subhead">
          Transfer ke keluarga di Indonesia dalam hitungan detik, bukan hari —
          dengan biaya mendekati nol. Bukan omong kosong: verifiable di blockchain.
        </p>

        {/* CTA row */}
        <div className="hero__cta-row">
          <Link to="/signup" className="btn-primary hero__cta-main" id="hero-cta-signup">
            Mulai Kirim Sekarang →
          </Link>
          <a href="#stats" className="btn-ghost">
            Lihat datanya
          </a>
        </div>

        {/* Live ticker bar */}
        <div className="hero__ticker" aria-label="Metrik kecepatan">
          <div className="hero__ticker-item">
            <span className="hero__ticker-label mono">Settlement time</span>
            <span className="hero__ticker-value">&lt; 5 detik</span>
          </div>
          <div className="hero__ticker-divider" />
          <div className="hero__ticker-item">
            <span className="hero__ticker-label mono">Biaya jaringan</span>
            <span className="hero__ticker-value">≈ Rp 0</span>
          </div>
          <div className="hero__ticker-divider" />
          <div className="hero__ticker-item">
            <span className="hero__ticker-label mono">Bank tradisional</span>
            <span className="hero__ticker-value hero__ticker-red">1-3 hari · 4,8%</span>
          </div>
        </div>
      </div>

      {/* Decorative bg element */}
      <div className="hero__bg-blob" aria-hidden="true" />
    </section>
  )
}

// ── Section 2: Problem Stats ─────────────────────────────────────────────────
function StatsSection() {
  const { ref, inView } = useInView()

  const stats = [
    { value: 288, suffix: 'T', prefix: 'Rp', label: 'Remitansi PMI 2025', sub: 'tumbuh 14% dari tahun lalu' },
    { value: 48, suffix: '%', label: 'Biaya rata-rata hilang', sub: 'di corridor Malaysia → Indonesia adalah 4,80%*' },
    { value: 39, suffix: ' Juta', label: 'PMI Indonesia', sub: 'mengirim rata-rata Rp64 juta per tahun' },
  ]

  return (
    <section className="stats-section" id="stats" aria-labelledby="stats-heading"
      ref={ref as React.RefObject<HTMLElement>}>
      <div className="page-container">
        <div className={`stats-section__header ${inView ? 'anim-in' : ''}`}>
          <span className="tag">Realita di lapangan</span>
          <h2 id="stats-heading" className="heading-lg stats-section__title">
            Uang Kamu<br />Susut di Perjalanan
          </h2>
          <p className="stats-section__desc">
            Setiap MYR yang kamu kirim, sebagian besar hilang sebagai biaya —
            bukan karena harus, tapi karena belum ada alternatif yang lebih baik.
          </p>
        </div>

        <div className={`stats-grid ${inView ? 'anim-in' : ''}`}>
          {stats.map((s, i) => (
            <div key={i} className="stat-card card" style={{ animationDelay: `${i * 120}ms` }}>
              <div className="stat-card__number display">
                {inView
                  ? <AnimatedNumber target={s.value} suffix={s.suffix} prefix={s.prefix} />
                  : `${s.prefix ?? ''}0${s.suffix}`
                }
              </div>
              <div className="stat-card__label">{s.label}</div>
              <div className="stat-card__sub mono">{s.sub}</div>
            </div>
          ))}
        </div>

        <p className="stats-section__source mono">
          * Sumber: World Bank Remittance Prices Worldwide, corridor MY→ID, nominal ~USD65
        </p>
      </div>
    </section>
  )
}

// ── Section 3: What is Kirim ─────────────────────────────────────────────────
function WhatIsSection() {
  const { ref, inView } = useInView()

  return (
    <section className="whatis-section" id="whatis" aria-labelledby="whatis-heading"
      ref={ref as React.RefObject<HTMLElement>}>
      <div className="page-container">
        <div className={`whatis-grid ${inView ? 'anim-in' : ''}`}>
          {/* Left: text */}
          <div className="whatis-text">
            <span className="tag">Apa itu Kirim?</span>
            <h2 id="whatis-heading" className="heading-lg whatis-text__title">
              Infrastruktur<br />Remitansi<br />
              <span className="whatis-text__accent">Generasi Baru</span>
            </h2>
            <p className="whatis-text__body">
              Kirim bukan aplikasi kripto. Kirim adalah lapisan settlement yang menggunakan
              jaringan Stellar di backend — kamu cukup input nominal MYR,
              keluarga di Indonesia terima rupiah ke rekening mereka.
            </p>
            <p className="whatis-text__body">
              Kripto hanya dipakai di infrastruktur backend untuk kecepatan dan efisiensi.
              Kamu tidak perlu paham blockchain untuk pakai Kirim.
            </p>
            <div className="whatis-badges">
              <span className="tag">Stellar Network</span>
              <span className="tag">SEP-24 Anchor</span>
              <span className="tag tag-yellow">Bukan alat pembayaran kripto</span>
            </div>
          </div>

          {/* Right: visual card */}
          <div className="whatis-visual">
            <div className="whatis-card card-inverted">
              <div className="mono whatis-card__label">Settlement path</div>
              <div className="whatis-flow">
                <div className="whatis-flow__step">
                  <span className="whatis-flow__icon">🇲🇾</span>
                  <div>
                    <div className="whatis-flow__title">Pengirim (Malaysia)</div>
                    <div className="mono whatis-flow__sub">Input MYR · Autentikasi</div>
                  </div>
                </div>
                <div className="whatis-flow__arrow">↓</div>
                <div className="whatis-flow__step whatis-flow__step--accent">
                  <span className="whatis-flow__icon">⚡</span>
                  <div>
                    <div className="whatis-flow__title">Stellar Network</div>
                    <div className="mono whatis-flow__sub">Settlement &lt;5 detik · Fee ≈ $0</div>
                  </div>
                </div>
                <div className="whatis-flow__arrow">↓</div>
                <div className="whatis-flow__step">
                  <span className="whatis-flow__icon">🇮🇩</span>
                  <div>
                    <div className="whatis-flow__title">Penerima (Indonesia)</div>
                    <div className="mono whatis-flow__sub">Terima IDR · Rekening bank / e-wallet</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Section 4: Cost Comparison ───────────────────────────────────────────────
function CostSection() {
  const { ref, inView } = useInView()
  const amount = 1000 // MYR example
  const tradFeeRate = 0.048
  const kirimFeeRate = 0.0000

  return (
    <section className="cost-section" id="cost" aria-labelledby="cost-heading"
      ref={ref as React.RefObject<HTMLElement>}>
      <div className="page-container">
        <div className={`cost-header ${inView ? 'anim-in' : ''}`}>
          <span className="tag tag-yellow">Kalkulator Perbandingan</span>
          <h2 id="cost-heading" className="heading-lg">
            Berapa yang Kamu<br />Hemat dengan Kirim?
          </h2>
        </div>

        <div className={`cost-comparison ${inView ? 'anim-in' : ''}`}>
          {/* Traditional */}
          <div className="cost-card cost-card--bad">
            <div className="cost-card__label mono">Bank Tradisional</div>
            <div className="cost-card__amount display">
              MYR {(amount * tradFeeRate).toFixed(0)}
            </div>
            <div className="cost-card__sublabel">hilang sebagai biaya per MYR1,000</div>
            <ul className="cost-card__list">
              <li>⏳ 1–3 hari kerja</li>
              <li>📄 Antri & formulir fisik</li>
              <li>💸 4,80% rata-rata biaya</li>
              <li>🔒 Kurs tidak transparan</li>
            </ul>
          </div>

          {/* VS divider */}
          <div className="cost-vs" aria-hidden="true">VS</div>

          {/* Kirim */}
          <div className="cost-card cost-card--good">
            <div className="cost-card__label mono">Kirim</div>
            <div className="cost-card__amount display cost-card__amount--mint">
              MYR {(amount * kirimFeeRate).toFixed(0)}
            </div>
            <div className="cost-card__sublabel">biaya jaringan per MYR1,000</div>
            <ul className="cost-card__list">
              <li>⚡ &lt; 5 detik settlement</li>
              <li>📱 Dari HP, kapan saja</li>
              <li>✅ Biaya mendekati nol</li>
              <li>🔍 Verifiable di blockchain</li>
            </ul>
            <div className="cost-card__savings">
              Hemat ≈ <strong>MYR {(amount * tradFeeRate).toFixed(0)}</strong> per kiriman
            </div>
          </div>
        </div>
        <p className="cost-disclaimer mono">
          * Biaya jaringan Stellar: ~0.00001 XLM per transaksi ≈ Rp0,01. Simulasi di atas menggunakan data World Bank 2024.
        </p>
      </div>
    </section>
  )
}

// ── Section 5: Features ──────────────────────────────────────────────────────
function FeaturesSection() {
  const { ref, inView } = useInView()

  const features = [
    {
      icon: '🔀',
      title: 'Split ke Banyak Penerima',
      body: 'Satu kiriman bisa dibagi ke istri, orang tua, dan tabungan anak sekaligus — satu transaksi, atomik, tidak bisa gagal sebagian.',
      tag: 'Multi-recipient',
    },
    {
      icon: '🌱',
      title: 'Dana Idle? Dapatkan Yield',
      body: 'Dana yang belum dicairkan bisa diputar di Blend Protocol dan menghasilkan bunga hingga 8,5% APY — berjalan per detik di blockchain.',
      tag: 'Blend Protocol',
    },
    {
      icon: '⚡',
      title: 'Settlement dalam Detik',
      body: 'Stellar menyelesaikan transaksi dalam &lt;5 detik — bukan hitungan jam, bukan hari kerja. Verifiable langsung di Stellar Explorer.',
      tag: 'Stellar Network',
    },
    {
      icon: '🔍',
      title: 'Transparan & Dapat Diverifikasi',
      body: 'Setiap transaksi punya hash on-chain yang bisa kamu cek sendiri. Tidak ada biaya tersembunyi, tidak ada kurs gelap.',
      tag: 'On-chain',
    },
    {
      icon: '🏦',
      title: 'Cairkan ke Rekening Bank',
      body: 'Penerima di Indonesia bisa tarik dana langsung ke BCA, BNI, BRI, Mandiri, dan Permata — dalam Rupiah, tanpa perlu tahu soal kripto.',
      tag: 'Off-ramp IDR',
    },
    {
      icon: '🔐',
      title: 'Login Tanpa Password Ribet',
      body: 'Daftar dengan email, akun Stellar dikelola otomatis di backend. Tidak perlu simpan seed phrase, tidak perlu pasang wallet extension.',
      tag: 'Custodial-lite',
    },
  ]

  return (
    <section className="features-section" id="features" aria-labelledby="features-heading"
      ref={ref as React.RefObject<HTMLElement>}>
      <div className="page-container">
        <div className={`features-header ${inView ? 'anim-in' : ''}`}>
          <span className="tag">Fitur</span>
          <h2 id="features-heading" className="heading-lg features-header__title">
            Semua yang Kamu<br />Butuhkan, Satu Tempat
          </h2>
        </div>

        <div className={`features-grid ${inView ? 'anim-in' : ''}`}>
          {features.map((f, i) => (
            <div
              key={i}
              className={`feature-card card ${i === 1 ? 'feature-card--highlight' : ''}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="feature-card__icon" aria-hidden="true">{f.icon}</div>
              <span className="tag feature-card__tag">{f.tag}</span>
              <h3 className="heading-sm feature-card__title">{f.title}</h3>
              <p className="feature-card__body" dangerouslySetInnerHTML={{ __html: f.body }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Section 6: How It Works ──────────────────────────────────────────────────
function HowSection() {
  const { ref, inView } = useInView()

  const steps = [
    { n: '01', actor: '🇲🇾 Pengirim', title: 'Daftar & Top Up', body: 'Buat akun dengan email. Akun Stellar provisioned otomatis. Isi saldo MYR (simulasi testnet).' },
    { n: '02', actor: '🇲🇾 Pengirim', title: 'Tentukan Penerima & Porsi', body: 'Pilih satu atau lebih penerima, atur berapa persen untuk masing-masing. Bisa kirim ke 5 penerima sekaligus.' },
    { n: '03', actor: '⚡ Stellar', title: 'Settlement Instan', body: 'Transaksi dikirim ke Stellar Network dan selesai dalam &lt;5 detik. Hash on-chain langsung tersedia.' },
    { n: '04', actor: '🇮🇩 Penerima', title: 'Terima & Pilih', body: 'Penerima bisa langsung cairkan ke rekening bank IDR, atau simpan di Blend untuk dapatkan yield.' },
  ]

  return (
    <section className="how-section" id="how" aria-labelledby="how-heading"
      ref={ref as React.RefObject<HTMLElement>}>
      <div className="page-container">
        <div className={`how-header ${inView ? 'anim-in' : ''}`}>
          <span className="tag">Cara Kerja</span>
          <h2 id="how-heading" className="heading-lg">
            Empat Langkah.<br />Satu Transaksi.
          </h2>
        </div>

        <div className={`how-steps ${inView ? 'anim-in' : ''}`}>
          {steps.map((s, i) => (
            <div key={i} className="how-step" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="how-step__num display" aria-hidden="true">{s.n}</div>
              <div className="how-step__content">
                <span className="tag how-step__actor">{s.actor}</span>
                <h3 className="heading-sm how-step__title">{s.title}</h3>
                <p className="how-step__body" dangerouslySetInnerHTML={{ __html: s.body }} />
              </div>
              {i < steps.length - 1 && <div className="how-step__connector" aria-hidden="true" />}
            </div>
          ))}
        </div>

        {/* Final CTA */}
        <div className={`how-cta ${inView ? 'anim-in' : ''}`}>
          <p className="how-cta__text">Siap coba? Daftar gratis, tidak perlu kartu kredit.</p>
          <Link to="/signup" className="btn-primary how-cta__btn" id="how-cta-signup">
            Buat Akun Sekarang →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Footer ───────────────────────────────────────────────────────────────────
function LandingFooter() {
  return (
    <footer className="landing-footer" role="contentinfo">
      <div className="page-container landing-footer__inner">
        <div className="landing-footer__brand">
          <span className="display landing-footer__logo">KIRIM</span>
          <p className="landing-footer__tagline mono">
            Infrastruktur settlement lintas negara via Stellar Network.
          </p>
          <p className="landing-footer__compliance">
            Kirim adalah lapisan teknologi, bukan penerbit alat pembayaran kripto.
            Penerima selalu menerima Rupiah asli melalui kanal berlisensi.
          </p>
        </div>

        <div className="landing-footer__links">
          <div className="landing-footer__col">
            <div className="landing-footer__col-title mono">Produk</div>
            <a href="#features">Fitur</a>
            <a href="#how">Cara Kerja</a>
            <a href="#cost">Perbandingan Biaya</a>
          </div>
          <div className="landing-footer__col">
            <div className="landing-footer__col-title mono">Akun</div>
            <Link to="/login">Masuk</Link>
            <Link to="/signup">Daftar Gratis</Link>
          </div>
          <div className="landing-footer__col">
            <div className="landing-footer__col-title mono">Dibangun di atas</div>
            <a href="https://stellar.org" target="_blank" rel="noreferrer">Stellar Network</a>
            <a href="https://blend.capital" target="_blank" rel="noreferrer">Blend Protocol</a>
          </div>
        </div>
      </div>

      <div className="landing-footer__bottom">
        <div className="page-container">
          <span className="mono">© 2026 Kirim · APAC Stellar Hackathon</span>
          <span className="mono">Built on Stellar Testnet · For demo purposes</span>
        </div>
      </div>
    </footer>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function LandingPage() {
  return (
    <>
      <LandingNav />
      <main id="main-content">
        <HeroSection />
        <StatsSection />
        <WhatIsSection />
        <CostSection />
        <FeaturesSection />
        <HowSection />
      </main>
      <LandingFooter />
    </>
  )
}