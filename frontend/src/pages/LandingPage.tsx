import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconHourglassHigh, IconMoodAngry, IconBusinessplan, IconCurrencyDollarOff, IconBolt,  IconDeviceMobile,  IconBrandStellar, IconAffiliate, IconPigMoney, IconBoltFilled, IconBuildingBank, IconLockPassword } from '@tabler/icons-react';
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
    <nav className={`landing-nav ${scrolled ? 'landing-nav--scrolled' : ''}`} aria-label="Main navigation">
      <div className="landing-nav__inner">
        <span className="landing-nav__brand" aria-label="Kirim">
          <img src={scrolled ? '/logokirimblack.png' : '/logokirimwhite.png'} alt="logo kirim" />
          
        </span>
        <div className="landing-nav__links">
          <a href="#how" className="landing-nav__link">How it Works</a>
          <a href="#features" className="landing-nav__link">Features</a>
          <Link to="/login" className="btn-ghost landing-nav__btn">Log In</Link>
          <Link to="/signup" className="btn-primary landing-nav__btn">Sign Up</Link>
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
          ✦ Quick Remittance · Malaysia → Indonesia
        </span>

        {/* Headline */}
        <h1 id="hero-heading" className="display hero__headline">
          Send <br />
          <span className="hero__headline-mint">Money</span><br />
          Without Crazy Fees
        </h1>

        <p className="hero__subhead">
          Transfer to your family in Indonesia in seconds with near-ZERO fees
        </p>

        {/* CTA row */}
        <div className="hero__cta-row">
          <Link to="/signup" className="btn-primary hero__cta-main" id="hero-cta-signup">
            Start Sending Now →
          </Link>
        </div>

        {/* Live ticker bar */}
        <div className="hero__ticker" aria-label="Speed metrics">
          <div className="hero__ticker-item">
            <span className="hero__ticker-label mono">Processing Time</span>
            <span className="hero__ticker-value">&lt; 5 seconds</span>
          </div>
          <div className="hero__ticker-divider" />
          <div className="hero__ticker-item">
            <span className="hero__ticker-label mono">Transfer Fee</span>
            <span className="hero__ticker-value">≈ Rp 0</span>
          </div>
          <div className="hero__ticker-divider" />
          <div className="hero__ticker-item">
            <span className="hero__ticker-label mono">Traditional banks</span>
            <span className="hero__ticker-value hero__ticker-red">1-3 days · 4.8%</span>
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
    { value: 288, suffix: 'T', prefix: 'Rp', label: 'Migrant Worker Remittances 2025', sub: 'grew 14% from last year' },
    { value: 48, suffix: '%', label: 'Average Fee Lost', sub: 'in the Malaysia → Indonesia corridor is 4.80%*' },
    { value: 39, suffix: ' Million', label: 'Indonesian Migrant Workers', sub: 'send an average of Rp64 million per year' },
  ]

  return (
    <section className="stats-section" id="stats" aria-labelledby="stats-heading"
      ref={ref as React.RefObject<HTMLElement>}>
      <div className="page-container">
        <div className={`stats-section__header ${inView ? 'anim-in' : ''}`}>
          <span className="tag">Reality Problem</span>
          <h2 id="stats-heading" className="heading-lg stats-section__title">
            Your Money<br />Shrinks on the Way
          </h2>
          <p className="stats-section__desc">
            Every MYR you send, a large portion is lost to fees. Not because it has to be, but because there hasn't been a better alternative.
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
          * Source: World Bank Remittance Prices Worldwide
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
            <span className="tag">What is Kirim?</span>
            <h2 id="whatis-heading" className="heading-lg whatis-text__title">
              Next-Generation<br />Remittance<br />
              <span className="whatis-text__accent">Infrastructure</span>
            </h2>
            <p className="whatis-text__body">
              Kirim isn't a crypto app. It's a money transfer service from Malaysia to Indonesia powered by crypto technology via the Stellar network.
              You just input/top-up MYR,
              and your family in Indonesia receives Rupiah straight to their bank accounts.
            </p>
            <div className="whatis-badges">
              <span className="tag">Fast</span>
              <span className="tag">Cheap</span>
              <span className="tag tag-yellow">Transparent</span>
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
                    <div className="whatis-flow__title">Sender (Malaysia)</div>
                    <div className="mono whatis-flow__sub">Input MYR · Authenticate</div>
                  </div>
                </div>
                <div className="whatis-flow__arrow">↓</div>
                <div className="whatis-flow__step whatis-flow__step--accent">
                  <IconBrandStellar />
                  <div>
                    <div className="whatis-flow__title">Stellar Network</div>
                    <div className="mono whatis-flow__sub">Arrives in &lt;5 seconds · fee ≈ $0</div>
                  </div>
                </div>
                <div className="whatis-flow__arrow">↓</div>
                <div className="whatis-flow__step">
                  <span className="whatis-flow__icon">🇮🇩</span>
                  <div>
                    <div className="whatis-flow__title">Receiver (Indonesia)</div>
                    <div className="mono whatis-flow__sub">Receive IDR · Bank account / e-wallet</div>
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
          <span className="tag tag-yellow">Comparison</span>
          <h2 id="cost-heading" className="heading-lg">
            How much do you<br />Save with Kirim?
          </h2>
        </div>

        <div className={`cost-comparison ${inView ? 'anim-in' : ''}`}>
          {/* Traditional */}
          <div className="cost-card cost-card--bad">
            <div className="cost-card__label mono">Traditional Banks</div>
            <div className="cost-card__amount display">
              MYR {(amount * tradFeeRate).toFixed(0)}
            </div>
            <div className="cost-card__sublabel">lost to fees per MYR 1,000</div>
            <ul className="cost-card__list">
              <li className='cost-card__list__item'> 
                <IconHourglassHigh />
                1–3 Business days
              </li>
              <li className='cost-card__list__item'>
                <IconMoodAngry />
                Queues & physical forms
              </li>
              <li className='cost-card__list__item'> 
                <IconBusinessplan />
                4.80% average fee
              </li>
              <li className='cost-card__list__item'>
                <IconCurrencyDollarOff />
                 Non-transparent exchange rates
              </li>
            </ul>
          </div>

          {/* VS divider */}
          <div className="cost-vs" aria-hidden="true">VS</div>

          {/* Kirim */}
          <div className="cost-card cost-card--good">
            <div className="cost-card__label mono">Kirim</div>
            <div className="cost-card__amount display cost-card__amount--mint">
              MYR ≈{(amount * kirimFeeRate).toFixed(0)}
            </div>
            <div className="cost-card__sublabel">network fees per MYR 1,000</div>
            <ul className="cost-card__list">
              <li className='cost-card__list__item'>
                <IconBolt />
                 &lt; 5 seconds settlement
              </li>
              <li className='cost-card__list__item'>
                <IconDeviceMobile />
                 From your phone, anytime
              </li>
              <li className='cost-card__list__item'> 
                <IconCurrencyDollarOff />
                Near-ZERO fees
              </li>
              <li className='cost-card__list__item'>
                <IconBrandStellar />
                Transparent on the blockchain
              </li>
            </ul>
            <div className="cost-card__savings">
              Save ≈ <strong>MYR {(amount * tradFeeRate).toFixed(0)}</strong> per transfer
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Section 5: Features ──────────────────────────────────────────────────────
function FeaturesSection() {
  const { ref, inView } = useInView()

  const features = [
    {
      icon: 'IconAffiliate',
      title: 'Split to Multiple Recipients',
      body: 'One transfer can be split to your wife, parents, and kids\' savings all at once in a single, atomic transaction that won\'t partially fail.',
      tag: 'Multi-recipient',
    },
    {
      icon: 'IconPigMoney',
      title: 'Idle Funds? Earn Yield',
      body: 'Uncashed funds can be put to work on Blend Protocol, earning up to 8.5% APY in interest.',
      tag: 'Blend Protocol',
    },
    {
      icon: 'IconBolt',
      title: 'Settlement in Seconds',
      body: 'Stellar settles transactions in &lt;5 seconds, not hours or business days. Every transaction is transparent on Stellar Explorer.',
      tag: 'Stellar Network',
    },
    {
      icon: 'IconBrandStellar',
      title: 'Transparent & Verifiable',
      body: 'Every transaction has an on-chain hash you can verify yourself. No hidden fees, no shady exchange rates.',
      tag: 'On-chain',
    },
    {
      icon: 'IconBuildingBank',
      title: 'Withdraw to Bank Account',
      body: 'Receivers in Indonesia can withdraw funds directly to BCA, BNI, BRI, Mandiri, and Permata in Rupiah.',
      tag: 'Off-ramp IDR',
    },
    {
      icon: 'IconLockPassword',
      title: 'Hassle-Free Passwordless Login',
      body: 'Sign up with email, your account address is created automatically. You can instantly send to any address you want.',
      tag: 'Custodial-lite',
    },
  ]

  return (
    <section className="features-section" id="features" aria-labelledby="features-heading"
      ref={ref as React.RefObject<HTMLElement>}>
      <div className="page-container">
        <div className={`features-header ${inView ? 'anim-in' : ''}`}>
          <span className="tag">Features</span>
          <h2 id="features-heading" className="heading-lg features-header__title">
            Everything You<br />Need, in One Place
          </h2>
        </div>

        <div className={`features-grid ${inView ? 'anim-in' : ''}`}>
          {features.map((f, i) => (
            <div
              key={i}
              className={`feature-card card ${i === 1 ? 'feature-card--highlight' : ''}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="feature-card__header">
                 <span className="tag feature-card__tag">{f.tag}</span>
                <div className="feature-card__icon" aria-hidden="true">{
                  f.icon === 'IconAffiliate' ? <IconAffiliate size={32} /> :
                    f.icon === 'IconPigMoney' ? <IconPigMoney size={32} /> :
                      f.icon === 'IconBolt' ? <IconBolt size={32} /> :
                        f.icon === 'IconBuildingBank' ? <IconBuildingBank size={32} /> :
                          f.icon === 'IconLockPassword' ? <IconLockPassword size={32} /> :
                            <IconBrandStellar size={32} />
                }</div>

              </div>
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
    { n: '01', actor: '🇲🇾 Sender', title: 'Sign Up & Top Up', body: 'Create an account with email. Your account and address will be automatically generated. Top up your MYR balance.' },
    { n: '02', actor: '🇲🇾 Sender', title: 'Set Recipients & Portions', body: 'Select one or more recipients and set the percentage for each. You can send to up to 5 recipients at once.' },
    { n: '03', actor: 'Stellar Network', title: 'Instant Settlement', body: 'Transactions are sent to the Stellar Network and settled in &lt;5 seconds. Your transaction is instantly recorded on the network and can be verified anytime.' },
    { n: '04', actor: '🇮🇩 Receiver', title: 'Receive & Choose', body: 'Receivers can instantly withdraw to a bank account in IDR, or keep it in Blend to earn yield.' },
  ]

  return (
    <section className="how-section" id="how" aria-labelledby="how-heading"
      ref={ref as React.RefObject<HTMLElement>}>
      <div className="page-container">
        <div className={`how-header ${inView ? 'anim-in' : ''}`}>
          <span className="tag">How it Works</span>
          <h2 id="how-heading" className="heading-lg">
            4 Steps.<br />1 Transaction.
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
          <p className="how-cta__text">Ready to try? Sign up for free.</p>
          <Link to="/signup" className="btn-primary how-cta__btn" id="how-cta-signup">
            Create Account Now →
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
            Cross-border settlement infrastructure via the Stellar Network.
          </p>
          <p className="landing-footer__compliance">
            Kirim is a technology layer, not a cryptocurrency issuer.
            Receivers always receive real Rupiah through licensed channels.
          </p>
        </div>

        <div className="landing-footer__links">
          <div className="landing-footer__col">
            <div className="landing-footer__col-title mono">Product</div>
            <a href="#features">Features</a>
            <a href="#how">How it Works</a>
            <a href="#cost">Cost Comparison</a>
          </div>
          <div className="landing-footer__col">
            <div className="landing-footer__col-title mono">Account</div>
            <Link to="/login">Log In</Link>
            <Link to="/signup">Sign Up Free</Link>
          </div>
          <div className="landing-footer__col">
            <div className="landing-footer__col-title mono">Built on</div>
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