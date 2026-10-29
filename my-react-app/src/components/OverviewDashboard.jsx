import {
  ReceiptText,
  Bell,
  UserPlus,
  BarChart3,
  CreditCard,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react'

export default function OverviewDashboard({
  currentUser,
  consumers,
  bills,
  payments,
  complaints,
  onNavigate,
  onOpenRegisterModal,
  flash,
}) {
  const isOfficeStaff = currentUser?.role === 'Office Staffs'
  const isPresident = currentUser?.role === 'President'

  // Live computed stats
  const totalCollections = payments.reduce((acc, p) => acc + p.amountPaid, 184620.50)
  const activeConnections = consumers.filter((c) => c.status === 'Active').length + 2480
  const overdueBills = bills.filter((b) => b.status === 'Overdue')
  const totalOutstanding = overdueBills.reduce((acc, b) => acc + b.totalAmount, 0) + 42815.25
  const readyBills = bills.filter((b) => b.status === 'Ready')
  const openComplaints = complaints.filter((c) => c.status !== 'Resolved')

  const displayName = currentUser?.fullName || 'Operator'

  return (
    <div className="overview-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">
            {isOfficeStaff
              ? 'OFFICE OPERATIONS & BILLING CONTROL DESK · LAMBAWASA'
              : isPresident
              ? 'EXECUTIVE OVERSIGHT & MUNICIPAL AUDIT · PRESIDENTIAL DESK'
              : 'WATER UTILITY OPERATIONS SYSTEM'}
          </p>
          <h1>Good day, {displayName.split(' ')[0]} <span>✦</span></h1>
          <p className="subheading">
            {isOfficeStaff
              ? 'Consumer household profiling, automated batch billing runs, customer notices, and problem reports are live.'
              : isPresident
              ? 'Real-time utility intelligence, revenue audits, staff workload, and pending billing adjustment approvals.'
              : 'Here is what is happening across your water network with all operational features synchronized in real time.'}
          </p>
        </div>
        <div className="heading-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isOfficeStaff ? (
            <>
              <button className="primary-button" onClick={() => onNavigate('Batch Billing')}>
                <ReceiptText size={16} /> Run Batch Billing ({readyBills.length})
              </button>
              <button className="btn-secondary" onClick={() => onNavigate('Notifications')}>
                <Bell size={16} /> Dispatch Notices
              </button>
              <button className="btn-secondary" onClick={onOpenRegisterModal}>
                <UserPlus size={16} /> Register Consumer
              </button>
            </>
          ) : !isPresident ? (
            <button className="primary-button" onClick={onOpenRegisterModal}>
              <UserPlus size={16} /> Register Consumer
            </button>
          ) : null}
        </div>
      </section>


      {/* KPI Stats Grid */}
      <section className="stats-grid">
        <article className="stat-card" onClick={() => onNavigate('Payment P.O.S.')}>
          <div className="stat-top">
            <span>Total Collections</span>
            <span className="stat-icon"><CreditCard size={16} /></span>
          </div>
          <strong>
            ₱ {totalCollections.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <p><mark>↑ 14.2%</mark> vs last billing cycle</p>
          <div className="mini-bars aqua">
            <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
        </article>

        <article className="stat-card" onClick={() => onNavigate('Household Profiling')}>
          <div className="stat-top">
            <span>Active Connections</span>
            <span className="stat-icon blue"><Users size={16} /></span>
          </div>
          <strong>{activeConnections.toLocaleString()}</strong>
          <p><mark>↑ 5.1%</mark> new households profiled</p>
          <div className="mini-bars blue-bars">
            <i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
        </article>

        <article className="stat-card" onClick={() => onNavigate('Arrears & Penalties')}>
          <div className="stat-top">
            <span>Outstanding Balance</span>
            <span className="stat-icon orange"><AlertTriangle size={16} /></span>
          </div>
          <strong>
            ₱ {totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <p className="warning-text">{overdueBills.length} accounts flagged for penalty</p>
          <div className="progress"><i /></div>
          <small className="progress-label">88% collected this period</small>
        </article>

        <article className="stat-card" onClick={() => onNavigate('Meter Assets')}>
          <div className="stat-top">
            <span>Meter Reading Accuracy</span>
            <span className="stat-icon green"><CheckCircle2 size={16} /></span>
          </div>
          <strong>98.6<span>%</span></strong>
          <p><mark className="green-mark">↑ 2.4%</mark> accuracy with calibration</p>
          <div className="ring">
            <div><b>98</b><small>%</small></div>
          </div>
        </article>
      </section>

      {/* Main Dashboard Panels */}
      <section className="dashboard-grid">
        {/* Recent Bills Panel */}
        <article className="panel billing-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">BILLING OPERATIONS</p>
              <h2>Recent Verified Bills</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate('Batch Billing')}>
              Open Batch Billing <span>→</span>
            </button>
          </div>

          <div className="bill-table" style={{ marginTop: '14px' }}>
            <div className="table-head">
              <span>CONSUMER</span>
              <span>PERIOD</span>
              <span>AMOUNT</span>
              <span>STATUS</span>
            </div>
            {bills.slice(0, 4).map((bill) => (
              <div className="bill-row" key={bill.id}>
                <div className="consumer">
                  <div className="avatar">{bill.avatar || 'CS'}</div>
                  <div>
                    <strong>{bill.name}</strong>
                    <small>{bill.id} · {bill.zone}</small>
                  </div>
                </div>
                <span className="muted">{bill.period}</span>
                <strong>₱ {bill.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                <span className={`status ${bill.status.toLowerCase()}`}>
                  <i /> {bill.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Spatial Map Teaser Panel */}
        <article className="panel map-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">NETWORK COVERAGE</p>
              <h2>Geographical Map</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate('Geographical Mapping')}>
              Full Spatial View <span>→</span>
            </button>
          </div>

          <div className="map" onClick={() => onNavigate('Geographical Mapping')} style={{ cursor: 'pointer' }}>
            <div className="map-grid" />
            <div className="river" />
            <div className="road road-one" />
            <div className="road road-two" />
            <span className="map-pin pin-one">●</span>
            <span className="map-pin pin-two">●</span>
            <span className="map-pin pin-three">●</span>
            <span className="map-pin pin-four">●</span>
            <div className="map-label north">MABUHAY <b>486</b></div>
            <div className="map-label river-label">RIVERSIDE <b>328</b></div>
            <div className="map-label east">EAST MARKET <b>514</b></div>
            <div className="map-legend">
              <span><i className="pin-aqua" /> Active</span>
              <span><i className="pin-orange" /> Attention</span>
            </div>
          </div>
          <div className="map-footer">
            <span><b>{activeConnections.toLocaleString()}</b> mapped connections</span>
            <button onClick={() => onNavigate('Geographical Mapping')}>Launch GIS Inspector →</button>
          </div>
        </article>
      </section>

      {/* Quick Launchpad & Service Alerts */}
      <section className="bottom-grid">
        <article className="panel actions-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">FEATURE LAUNCHPAD</p>
              <h2>Quick Actions Across All 9 Systems</h2>
            </div>
          </div>

          <div className="quick-actions" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <button onClick={() => onNavigate('Household Profiling')}>
              <span className="action-icon aqua-icon">♧</span>
              <span>
                <strong>Profiling</strong>
                <small>Consumer records</small>
              </span>
              <b>→</b>
            </button>

            <button onClick={() => onNavigate('Meter Assets')}>
              <span className="action-icon blue-icon">▣</span>
              <span>
                <strong>Meter Assets</strong>
                <small>Calibrations & logs</small>
              </span>
              <b>→</b>
            </button>

            {!isOfficeStaff && (
              <button onClick={() => onNavigate('Consumption Calculator')}>
                <span className="action-icon aqua-icon">⌁</span>
                <span>
                  <strong>Calculator</strong>
                  <small>Fixed ₱10 per m³ billing</small>
                </span>
                <b>→</b>
              </button>
            )}

            <button onClick={() => onNavigate('Batch Billing')}>
              <span className="action-icon orange-icon">▤</span>
              <span>
                <strong>Batch Billing</strong>
                <small>Multi-account run</small>
              </span>
              <b>→</b>
            </button>

            <button onClick={() => onNavigate('Arrears & Penalties')}>
              <span className="action-icon orange-icon">!</span>
              <span>
                <strong>Arrears Tracker</strong>
                <small>Penalties & aging</small>
              </span>
              <b>→</b>
            </button>

            <button onClick={() => onNavigate('Payment P.O.S.')}>
              <span className="action-icon blue-icon">₱</span>
              <span>
                <strong>Payment POS</strong>
                <small>Counter receipts</small>
              </span>
              <b>→</b>
            </button>
          </div>
        </article>

        {/* Live Service Desk Feed */}
        <article className="panel service-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">REPORT PROBLEM</p>
              <h2>Maintenance & Support</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate('Service Desk')}>
              View Tickets <span>→</span>
            </button>
          </div>

          <div className="service-list">
            {complaints.slice(0, 3).map((item) => (
              <div key={item.id}>
                <span className={`service-dot ${item.priority === 'Urgent' ? 'urgent' : ''}`} />
                <span>
                  <strong>{item.issueType}</strong>
                  <small>{item.consumerName} · {item.zone}</small>
                </span>
                <b className={item.priority === 'Urgent' ? 'badge-urgent' : ''}>
                  {item.status}
                </b>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
