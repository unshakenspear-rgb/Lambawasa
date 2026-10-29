import { useState } from 'react'

export default function NotificationsModule({
  consumers,
  bills,
  notifications,
  onSendNotification,
  flash,
}) {
  const [activeTab, setActiveTab] = useState('compose')
  const [noticeType, setNoticeType] = useState('Billing Notice')
  const [targetAccount, setTargetAccount] = useState('')
  const [channel, setChannel] = useState('SMS')
  const [customMessage, setCustomMessage] = useState('')

  // Overdue consumers
  const overdueBills = bills.filter((b) => b.status === 'Overdue')

  // Auto-compose message template based on type
  const handleTypeChange = (type) => {
    setNoticeType(type)
    if (type === 'Billing Notice') {
      setCustomMessage('Your monthly water consumption bill has been generated and is ready for payment. Please settle on or before your due date.')
    } else if (type === 'Payment Reminder') {
      setCustomMessage('Friendly reminder: Your water utility statement due date is approaching in 5 days. You can pay via POS or online channels.')
    } else if (type === 'Overdue Notice') {
      setCustomMessage('URGENT NOTICE: Your water service account has past-due arrears. Settle immediately to prevent service disconnection.')
    } else {
      setCustomMessage('System maintenance alert: Intermittent pressure scheduled for tomorrow 1:00 PM - 5:00 PM.')
    }
  }

  const handleSendSingle = (e) => {
    e.preventDefault()
    if (!targetAccount) {
      flash('Please select a recipient consumer.')
      return
    }

    const consumer = consumers.find((c) => c.accountNo === targetAccount)
    const newNotice = {
      id: `NTF-00${notifications.length + 1}`,
      type: noticeType,
      recipient: consumer ? consumer.name : 'Target Consumer',
      accountNo: targetAccount,
      message: customMessage,
      sentAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      status: 'Sent',
      channel,
    }

    onSendNotification(newNotice)
    flash(`Dispatched ${noticeType} to ${newNotice.recipient} (${channel}).`)
    setCustomMessage('')
  }

  const handleBroadcastOverdue = () => {
    if (overdueBills.length === 0) {
      flash('No overdue accounts require notice dispatch.')
      return
    }

    overdueBills.forEach((b, index) => {
      const newNotice = {
        id: `NTF-00${notifications.length + 1 + index}`,
        type: 'Overdue Notice',
        recipient: b.name,
        accountNo: b.accountNo,
        message: `FINAL NOTICE: Delinquent balance of ₱${b.totalAmount.toFixed(2)} is overdue by ${b.daysOverdue} days. Settle today.`,
        sentAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        status: 'Sent',
        channel: 'SMS',
      }
      onSendNotification(newNotice)
    })

    flash(`Broadcast automated overdue warnings to ${overdueBills.length} delinquent accounts via SMS gateway.`)
  }

  return (
    <div className="module-page fade-in">
      <div className="module-header-row">
        <div>
          <h2>Automated & Manual Notifications</h2>
          <p className="subtext">
            FDD Automated Messaging Engine: Dispatch Billing Notices, Payment Reminders, and Statutory Overdue Notices
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-pill-bar" style={{ display: 'flex', gap: '8px', margin: '14px 0 20px' }}>
        <button
          className={activeTab === 'compose' ? 'tab-pill active' : 'tab-pill'}
          onClick={() => setActiveTab('compose')}
        >
          ✉️ Compose & Send Notice
        </button>
        <button
          className={activeTab === 'log' ? 'tab-pill active' : 'tab-pill'}
          onClick={() => setActiveTab('log')}
        >
          📋 Sent Notifications Log ({notifications.length})
        </button>
        <button
          className={activeTab === 'automation' ? 'tab-pill active' : 'tab-pill'}
          onClick={() => setActiveTab('automation')}
        >
          ⚙️ Automated Triggers & CRON
        </button>
      </div>

      {/* 1. COMPOSE & DISPATCH */}
      {activeTab === 'compose' && (
        <div className="grid-2-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card-panel">
            <h3>Dispatch Single / Target Notice</h3>
            <form onSubmit={handleSendSingle} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label>
                Notice Category:
                <select value={noticeType} onChange={(e) => handleTypeChange(e.target.value)}>
                  <option value="Billing Notice">Send Billing Notice</option>
                  <option value="Payment Reminder">Send Payment Reminder</option>
                  <option value="Send Over Due Notice">Send Over Due Notice</option>
                  <option value="Service Advisory">Maintenance / Outage Advisory</option>
                </select>
              </label>

              <label>
                Recipient Household:
                <select value={targetAccount} onChange={(e) => setTargetAccount(e.target.value)} required>
                  <option value="">-- Choose Account --</option>
                  {consumers.map((c) => (
                    <option key={c.id} value={c.accountNo}>
                      {c.name} ({c.accountNo}) - {c.zone} [{c.status}]
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Dispatch Channel:
                <select value={channel} onChange={(e) => setChannel(e.target.value)}>
                  <option value="SMS">SMS Cellular Gateway (Direct Cellular)</option>
                  <option value="Email">Official District Email</option>
                  <option value="System Push">Lambawasa Consumer Portal Push</option>
                </select>
              </label>

              <label>
                Notice Message Content:
                <textarea
                  rows={4}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Enter notice body..."
                  required
                />
              </label>

              <button type="submit" className="primary-button">
                🚀 Send Notice Now
              </button>
            </form>
          </div>

          <div className="card-panel">
            <h3>Quick Overdue Accounts ({overdueBills.length})</h3>
            <p className="subtext">Households past their due date requiring overdue notices</p>
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {overdueBills.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: '#fff',
                    border: '1px solid #fee2e2',
                    borderRadius: '8px',
                    borderLeft: '4px solid #ef4444',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--ink)' }}>{b.name}</strong> <small style={{ color: '#64748b' }}>({b.accountNo})</small>
                    <div className="subtext" style={{ margin: '2px 0 0', color: '#dc2626', fontWeight: 600 }}>
                      Overdue: {b.daysOverdue} days · Balance: ₱{b.totalAmount.toFixed(2)}
                    </div>
                  </div>
                  <button
                    className="btn-danger-sm"
                    onClick={() => {
                      setTargetAccount(b.accountNo)
                      handleTypeChange('Send Over Due Notice')
                      setCustomMessage(`URGENT: Your balance of ₱${b.totalAmount.toFixed(2)} is overdue by ${b.daysOverdue} days. Settle immediately.`)
                      setActiveTab('compose')
                    }}
                  >
                    Quick Dispatch
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. LOG OF SENT NOTIFICATIONS */}
      {activeTab === 'log' && (
        <div className="card-panel">
          <div className="flex-between">
            <div>
              <h3>Dispatched Notifications Audit Log</h3>
              <p className="subtext">Chronological transmission history of customer communications</p>
            </div>
            <button className="btn-outline-sm" onClick={() => flash('Exported notification delivery report.')}>
              📥 Export Delivery Report
            </button>
          </div>
          <table className="data-table" style={{ width: '100%', marginTop: '14px' }}>
            <thead>
              <tr>
                <th>Notice ID</th>
                <th>Category</th>
                <th>Recipient</th>
                <th>Account No</th>
                <th>Channel</th>
                <th>Message Content</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td><code>{n.id}</code></td>
                  <td>
                    <span className={`pill ${n.type.includes('Over Due') ? 'pill-red' : n.type.includes('Billing') ? 'pill-cyan' : 'pill-yellow'}`}>
                      {n.type}
                    </span>
                  </td>
                  <td><strong>{n.recipient}</strong></td>
                  <td><code>{n.accountNo}</code></td>
                  <td><span className="pill pill-cyan">{n.channel}</span></td>
                  <td style={{ maxWidth: '300px' }}>{n.message}</td>
                  <td><small style={{ color: '#64748b' }}>{n.sentAt}</small></td>
                  <td><span className="pill pill-green">✓ {n.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. AUTOMATION & CRON SETTINGS */}
      {activeTab === 'automation' && (
        <div className="card-panel">
          <h3>Automated Trigger Engine (CRON Specifications)</h3>
          <p className="subtext">Configured automated notification routines compliant with Lambawasa statutory rules</p>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: 'var(--ink)' }}>Auto-Billing Notice Generator</strong>
                <p className="subtext" style={{ margin: '4px 0 0' }}>Automatically sends SMS & email statements upon Batch Bill Generation completion.</p>
              </div>
              <span className="pill pill-green">Active (Auto-Run)</span>
            </div>

            <div style={{ padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: 'var(--ink)' }}>Statutory 5-Day Due Date Reminder</strong>
                <p className="subtext" style={{ margin: '4px 0 0' }}>Dispatches polite reminder to all accounts 5 calendar days before bill due date.</p>
              </div>
              <span className="pill pill-green">Active (Daily 08:00 AM)</span>
            </div>

            <div style={{ padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: 'var(--ink)' }}>Automated Overdue & Penalty Notice (Grace Period Expiry)</strong>
                <p className="subtext" style={{ margin: '4px 0 0' }}>Triggered precisely 24 hours after bill due date. Applies 10% penalty and sends SMS alert.</p>
              </div>
              <span className="pill pill-green">Active (Daily 00:01 AM)</span>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
