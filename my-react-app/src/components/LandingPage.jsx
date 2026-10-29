import { useState } from 'react'
import DatabaseStatusBadge from './DatabaseStatusBadge'

export default function LandingPage({ onOpenLogin, onOpenRegister, onQuickExplore, flash, dbStatus, onSync, isSyncing, consumerOnly = false }) {
  const [calculatorUsage, setCalculatorUsage] = useState(18)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const baseBill = calculatorUsage * 10
  const envFee = +(baseBill * 0.1).toFixed(2)
  const maintFee = 2.0
  const estimatedTotal = +(baseBill + envFee + maintFee).toFixed(2)

  const featureCards = [
    {
      num: '01',
      title: 'Household Profiling System',
      desc: 'Manages complete, verified consumer records to ensure smooth field operations, accurate account tracking, and zero duplicate accounts.',
      tag: 'Profiling',
      icon: '♧',
    },
    {
      num: '02',
      title: 'Meter Asset Logging',
      desc: 'Maintains detailed logs of meter installations, repair schedules, and calibration histories to prevent reading inaccuracies and disputes.',
      tag: 'Hardware',
      icon: '▣',
    },
    {
      num: '03',
      title: 'Geographical Mapping',
      desc: 'Google Maps spatial base layer tracking individual connections, eliminating locational errors, and supporting drag-and-drop admin pin relocation.',
      tag: 'Google GIS',
      icon: '🗺️',
    },
    {
      num: '04',
      title: 'Automated Consumption Calculator',
      desc: 'Applies the fixed ₱10 per m³ consumption rate and flags dial inversion or unusual usage.',
      tag: 'Math Engine',
      icon: '🧮',
    },
    {
      num: '05',
      title: 'Batch Bill Generation',
      desc: 'Automates multi-account billing runs using verified meter readings to prevent operational delays during peak monthly billing periods.',
      tag: 'Billing Runs',
      icon: '▤',
    },
    {
      num: '06',
      title: 'Arrears & Penalty Tracker',
      desc: 'Flags unpaid accounts, categorizes aging brackets, and automatically computes 10% statutory overdue penalties and 48-hour disconnection notices.',
      tag: 'Arrears',
      icon: '⚠️',
    },
    {
      num: '07',
      title: 'Payment P.O.S. (Point of Sale)',
      desc: 'Facilitates fast cashier counter payments with instant Official Receipts (O.R.), automatic change calculation, and real-time ledger updates.',
      tag: 'Cashier Terminal',
      icon: '₱',
    },
    {
      num: '08',
      title: 'Operational Audit Trail',
      desc: 'Immutable security ledger logging all user actions, system modifications, terminal origins, and timestamps for absolute accountability.',
      tag: 'Audit Trail',
      icon: '🛡️',
    },
    {
      num: '09',
      title: 'Maintenance & Complaint Log',
      desc: 'End-to-end problem reporting for consumer support tickets, pipe leaks, and water pressure repairs from intake to field resolution.',
      tag: 'Report Problem',
      icon: '◇',
    },
  ]

  const scrollToSection = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing-wrapper">
      {/* Top Navigation Bar with requested Login button in top right */}
      <header className="landing-navbar">
        <div className={`landing-nav-inner ${mobileMenuOpen ? 'mobile-nav-open' : ''} ${consumerOnly ? 'consumer-only-nav' : ''}`}>
          <div className="landing-brand">
            <div className="brand-mark">
              <span /><span /><span />
            </div>
            <div>
              <strong>LAMBAWASA</strong>
              <small>Municipal Utility System</small>
            </div>
          </div>

          <button
            className="landing-mobile-menu-toggle"
            type="button"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
          >
            <span /><span /><span />
          </button>

          {!consumerOnly && (
            <div className="landing-nav-links" role="navigation">
              <button onClick={() => { scrollToSection('features-section'); setMobileMenuOpen(false) }}>Features</button>
              <button onClick={() => { scrollToSection('gis-section'); setMobileMenuOpen(false) }}>Google GIS</button>
              <button onClick={() => { scrollToSection('billing-estimate-section'); setMobileMenuOpen(false) }}>Billing Estimate</button>
              <button onClick={() => { scrollToSection('service-section'); setMobileMenuOpen(false) }}>Support & Hotline</button>
            </div>
          )}

          {/* Top Right Nav Bar Actions */}
          <div className="landing-nav-actions">
            {!consumerOnly && <DatabaseStatusBadge dbStatus={dbStatus} onSync={onSync} isSyncing={isSyncing} />}
            {onOpenRegister && (
              <button
                className="nav-secondary-btn"
                style={{ borderColor: '#38bdf8', color: '#38bdf8' }}
                onClick={() => { onOpenRegister(); setMobileMenuOpen(false) }}
              >
                <span>✦</span> {consumerOnly ? 'Register' : 'New Household'}
              </button>
            )}
            {!consumerOnly && (
              <button className="nav-secondary-btn" onClick={() => { onQuickExplore(); setMobileMenuOpen(false) }}>
                Explore Demo Portal <span>→</span>
              </button>
            )}
            {/* Separated Mobile-Friendly Login Action Buttons */}
            <button className="nav-login-btn" onClick={() => { onOpenLogin && onOpenLogin('consumer'); setMobileMenuOpen(false) }} id="top-nav-consumer-login-button" style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)' }}>
              <span>💧</span> Consumer Login
            </button>
            {!consumerOnly && (
              <button className="nav-login-btn" onClick={() => { onOpenLogin && onOpenLogin('field'); setMobileMenuOpen(false) }} id="top-nav-field-login-button" style={{ background: '#0f172a' }}>
                <span>👷</span> Field Staff
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-pill">
            <span className="pulse-dot" />
            <span>CLOUD & GIS INFRASTRUCTURE · 9 PROPOSED FEATURES ACTIVE</span>
          </div>

          <h1 className="hero-title">
            Intelligent Water Utility & Municipal Supply Operations
          </h1>

          <p className="hero-description">
            A comprehensive, modern platform connecting household profiling, hardware meter calibration, live Google spatial mapping, automated tiered billing, and counter POS collections with complete regulatory accountability.
          </p>

          <div className="hero-buttons">
            <button className="hero-primary-btn" onClick={() => onOpenLogin && onOpenLogin('consumer')}>
              <span>💧</span> Household Consumer Login
            </button>
            {onOpenRegister && (
              <button
                className="hero-secondary-btn"
                onClick={onOpenRegister}
              >
                <span>✦</span> Register New Household
              </button>
            )}
            {!consumerOnly && (
              <>
                <button className="hero-primary-btn" style={{ background: '#0f172a', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.35)' }} onClick={() => onOpenLogin && onOpenLogin('field')}>
                  <span>👷</span> Field Staff Operations
                </button>
                <button className="hero-secondary-btn" onClick={() => scrollToSection('features-section')}>
                  View Proposed Features <span>↓</span>
                </button>
              </>
            )}
          </div>

          {/* Real-time KPI Stats Ribbon */}
          <div className="hero-stats-ribbon">
            <div className="ribbon-stat">
              <span>ACTIVE CONNECTIONS</span>
              <strong>2,480+</strong>
              <small>Verified Households</small>
            </div>
            <div className="ribbon-stat">
              <span>METER ACCURACY</span>
              <strong className="text-aqua">98.6%</strong>
              <small>Certified Calibration</small>
            </div>
            <div className="ribbon-stat">
              <span>MONTHLY REVENUE</span>
              <strong className="text-success">₱ 184K+</strong>
              <small>Real-time Ledger</small>
            </div>
            <div className="ribbon-stat">
              <span>MUNICIPAL COVERAGE</span>
              <strong>4 Sectors</strong>
              <small>Google GIS Synchronized</small>
            </div>
          </div>
        </div>
      </section>

      {/* 9 Features Grid Showcase */}
      <section className="landing-section" id="features-section">
        <div className="section-header">
          <span className="section-eyebrow">COMPREHENSIVE UTILITY ARCHITECTURE</span>
          <h2>Features of the Proposed System</h2>
          <p className="section-subheading">
            Engineered specifically to solve municipal water district bottlenecks, eliminate inaccurate estimations, prevent overdue revenue losses, and guarantee operational transparency.
          </p>
        </div>

        <div className="features-grid">
          {featureCards.map((feat) => (
            <div className="feature-showcase-card" key={feat.num}>
              <div className="card-top-bar">
                <span className="card-icon">{feat.icon}</span>
                <span className="card-tag">{feat.tag}</span>
              </div>
              <span className="card-number">Feature {feat.num}</span>
              <h3>{feat.title}</h3>
              <p>{feat.desc}</p>
              {!consumerOnly && (
                <div className="card-footer-action">
                  <button onClick={onOpenLogin}>
                    Launch Feature <span>→</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Fixed-rate public bill estimator */}
      <section className="landing-section bg-alt" id="billing-estimate-section">
        <div className="billing-estimate-container">
          <div className="billing-estimate-copy">
            <span className="section-eyebrow">TRANSPARENT CONSUMER BILLING</span>
            <h2>Estimate Monthly Household Consumption</h2>
            <p>
              Bills use a fixed ₱10 per m³ usage rate, plus the 10% environmental fee and ₱2 maintenance charge.
            </p>

            <div className="billing-estimate-breakdown">
              <h4>How the estimate is calculated:</h4>
              <ul>
                <li><span>Water consumption:</span> <strong>₱10 per m³</strong></li>
                <li><span>Environmental Sewerage Fee:</span> <strong>10% of base</strong></li>
                <li><span>Meter Maintenance Fee:</span> <strong>₱2 fixed</strong></li>
              </ul>
            </div>
          </div>

          <div className="billing-estimate-card">
            <h3>Interactive Usage Calculator</h3>
            <p className="calculator-intro">Adjust your expected monthly water usage volume:</p>

            <label className="billing-estimate-label">
              Monthly Usage: <strong>{calculatorUsage} m³</strong> ({calculatorUsage * 1000} Liters)
            </label>
            <input
              type="range"
              min="5"
              max="60"
              value={calculatorUsage}
              onChange={(e) => setCalculatorUsage(Number(e.target.value))}
              className="usage-slider"
            />

            <div className="billing-estimate-output">
              <div className="output-row">
                <span>Base Commodity Rate:</span>
                <strong>₱ {baseBill.toFixed(2)}</strong>
              </div>
              <div className="output-row">
                <span>Environmental Fee (10%):</span>
                <strong>₱ {envFee.toFixed(2)}</strong>
              </div>
              <div className="output-row">
                <span>Meter Maintenance:</span>
                <strong>₱ {maintFee.toFixed(2)}</strong>
              </div>
              <div className="output-divider" />
              <div className="output-row total">
                <span>Estimated Monthly Bill:</span>
                <strong className="text-aqua">₱ {estimatedTotal.toFixed(2)}</strong>
              </div>
            </div>

            {!consumerOnly && (
              <button className="primary-button full" onClick={onOpenLogin} style={{ marginTop: '16px' }}>
                <span>🔒</span> Staff: Open Batch Billing Engine
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Google GIS Mapping Spotlight */}
      <section className="landing-section" id="gis-section">
        <div className="section-header">
          <span className="section-eyebrow">SPATIAL FIELD MANAGEMENT</span>
          <h2>Google Maps GIS & Household Locator</h2>
          <p className="section-subheading">
            Eliminate locational errors during meter reading runs, leak repairs, and disconnection dispatches with real-time coordinate mapping.
          </p>
        </div>

        <div className="gis-preview-banner">
          <div className="gis-banner-card">
            <div className="gis-header-info">
              <span className="dot dot-aqua" />
              <strong>Google Base Layer Integration (Roadmap · Satellite Hybrid · Terrain)</strong>
            </div>
            <p>
              Field officers and district engineers can locate every water curb stop, inspect meter calibration health, or drop new pins using Google GPS coordinates.
            </p>
            <div className="gis-pill-list">
              <span>📍 Mabuhay Sector (486 Connections)</span>
              <span>📍 Riverside Supply Line (328 Connections)</span>
              <span>📍 Hillview Booster Reservoir (382 Connections)</span>
              <span>📍 East Market Commercial Loop (514 Connections)</span>
            </div>
            {!consumerOnly && (
              <button className="hero-primary-btn" onClick={onOpenLogin} style={{ marginTop: '16px' }}>
                Launch Google Spatial Map (Login Required) <span>→</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Report Problem & Hotline Support */}
      <section className="landing-section bg-navy text-white" id="service-section">
        <div className="support-banner">
          <div>
            <span className="hud-badge">24/7 REPORT PROBLEM</span>
            <h2 className="text-white" style={{ marginTop: '8px' }}>Need Emergency Water Assistance?</h2>
            <p className="text-muted-light">
              Report pipe bursts, mainline leaks, low water pressure, or discolored water. Rapid field response teams are stationed in each sector.
            </p>
            <div className="hotline-badges">
              <div className="hotline-badge">
                <span>EMERGENCY DISPATCH</span>
                <strong>(02) 8912-WATER</strong>
              </div>
              <div className="hotline-badge">
                <span>SMS REPAIR DESK</span>
                <strong>+63 917 111 2233</strong>
              </div>
            </div>
          </div>
          {!consumerOnly && (
            <div className="support-action-box">
              <button className="primary-button btn-lg" onClick={onOpenLogin}>
                <span>◇</span> Report a Problem
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="brand-mark">
              <span /><span /><span />
            </div>
            <strong>LAMBAWASA</strong>
            <p>Republic of the Philippines · Municipal Waterworks & Utility Systems</p>
          </div>

          <div className="footer-status">
            <span className="live-status-dot" />
            <span>All Municipal Pipelines, Google GIS Nodes & Billing Servers Operational</span>
          </div>

          {!consumerOnly && (
            <div className="footer-links">
              <button onClick={onOpenLogin}>Staff Login</button>
              <button onClick={onQuickExplore}>Live Demo</button>
              <button onClick={() => flash('Documentation opened')}>System Architecture</button>
            </div>
          )}
        </div>
        <div className="footer-bottom-copy">
          &copy; 2026 Lambawasa Utility Management System. All Rights Reserved. Codified in compliance with Public Utility Standards.
        </div>
      </footer>
    </div>
  )
}
