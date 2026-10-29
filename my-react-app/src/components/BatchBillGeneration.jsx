import { useState } from 'react'
import {
  Crown,
  Calendar,
  AlertTriangle,
  FileText,
  Check,
  X,
  CreditCard,
  Printer,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'

export default function BatchBillGeneration({
  bills,
  currentUser = null,
  onUpdateBillScheduleAndPenalty,
  onDeleteBill,
  onOpenPOS,
  flash,
}) {
  const [billFilter, setBillFilter] = useState('All')
  const [selectedBillForPrint, setSelectedBillForPrint] = useState(null)
  const [billPendingDeletion, setBillPendingDeletion] = useState(null)
  const [isDeletingBill, setIsDeletingBill] = useState(false)
  const [editingBillForPresident, setEditingBillForPresident] = useState(null)
  const [overrideDueDate, setOverrideDueDate] = useState('')
  const [additionalArrears, setAdditionalArrears] = useState(0)
  const [overridePenalty, setOverridePenalty] = useState(0)
  const [overrideReason, setOverrideReason] = useState('Presidential Discretionary Adjustment')
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false)

  const isPresident = currentUser?.role === 'President' || currentUser?.role === 'Administrator'
  const canRemoveBills = currentUser?.role === 'President'

  const confirmBillRemoval = async () => {
    if (!billPendingDeletion || !onDeleteBill || isDeletingBill) return
    setIsDeletingBill(true)
    try {
      const removed = await onDeleteBill(billPendingDeletion)
      if (removed) {
        if (selectedBillForPrint?.id === billPendingDeletion.id) setSelectedBillForPrint(null)
        setBillPendingDeletion(null)
      }
    } finally {
      setIsDeletingBill(false)
    }
  }

  const calculateSuggestedPenalty = (bill, selectedDateStr) => {
    if (!selectedDateStr) return bill.penalty || 0
    const parts = selectedDateStr.split('-')
    const day = parts.length === 3 ? parseInt(parts[2], 10) : 20
    if (day > 25) {
      // Automatic 10% statutory overdue penalty
      return +((Number(bill.baseAmount || 0) + Number(bill.arrears || 0)) * 0.1).toFixed(2)
    }
    return bill.penalty || 0
  }

  const openPresidentAdjustmentModal = (bill) => {
    setEditingBillForPresident(bill)
    const initialDate = bill.dueDate || ''
    setOverrideDueDate(initialDate)
    setAdditionalArrears(0)
    const suggested = calculateSuggestedPenalty(bill, initialDate)
    setOverridePenalty(suggested)
    setOverrideReason(bill.presidentAdjustmentReason || 'Executive Schedule & Penalty Revision')
  }

  const handleDueDateChange = (newDate) => {
    setOverrideDueDate(newDate)
    if (!editingBillForPresident) return
    const parts = newDate.split('-')
    const day = parts.length === 3 ? parseInt(parts[2], 10) : 20
    if (day > 25) {
      const autoPenalty = +((Number(editingBillForPresident.baseAmount || 0) + Number(editingBillForPresident.arrears || 0) + Number(additionalArrears || 0)) * 0.1).toFixed(2)
      setOverridePenalty(autoPenalty)
      setOverrideReason(`Simulated Overdue: Scheduled for Day ${day} (Past 25th Deadline) - 10% Penalty Applied`)
    }
  }

  const handleAdditionalArrearsChange = (value) => {
    setAdditionalArrears(value)
    if (!editingBillForPresident || Number(overrideDueDate.split('-')[2] || 0) <= 25) return
    const updatedArrears = Number(editingBillForPresident.arrears || 0) + (Number(value) || 0)
    const autoPenalty = +((Number(editingBillForPresident.baseAmount || 0) + updatedArrears) * 0.1).toFixed(2)
    setOverridePenalty(autoPenalty)
  }

  const handleSavePresidentAdjustment = async (e) => {
    e.preventDefault()
    if (!editingBillForPresident || !onUpdateBillScheduleAndPenalty || isSavingAdjustment) return
    setIsSavingAdjustment(true)
    try {
      const saved = await onUpdateBillScheduleAndPenalty({
        billId: editingBillForPresident.id,
        newDueDate: overrideDueDate,
        addedArrears: Number(additionalArrears) || 0,
        penaltyAmount: Number(overridePenalty) || 0,
        reason: overrideReason,
      })
      if (!saved) return
      if (flash) {
        flash(`Updated Statement ${editingBillForPresident.id}: added ₱${Number(additionalArrears || 0).toFixed(2)} arrears. New arrears balance: ₱${(Number(editingBillForPresident.arrears || 0) + Number(additionalArrears || 0)).toFixed(2)}.`)
      }
      setEditingBillForPresident(null)
    } finally {
      setIsSavingAdjustment(false)
    }
  }

  const filteredBills = bills.filter((b) => {
    if (billFilter === 'All') return b.status !== 'Paid'
    return b.status === billFilter
  })

  const readyCount = bills.filter((b) => b.status === 'Ready').length
  const overdueCount = bills.filter((b) => b.status === 'Overdue').length
  const paidCount = bills.filter((b) => b.status === 'Paid').length
  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="feature-badge">Feature 05 · Batch Bill Generation</div>
          <h2>Automated Multi-Account Billing Run</h2>
          <p className="subheading">
            Automates multi-account billing runs using verified meter readings to prevent operational delays during peak billing periods.
          </p>
        </div>
      </div>

      {/* Automatic billing schedule */}
      <div className="batch-control-card">
        <div className="batch-config-grid">
          <div>
            <label className="batch-label">Automatic Billing Schedule</label>
            <div className="reading-health-indicator">
              <span className="dot dot-aqua" />
              <strong>Every 25th of the month</strong>
            </div>
          </div>

          <div>
            <label className="batch-label">Coverage</label>
            <div className="reading-health-indicator">
              <span className="dot dot-aqua" />
              <strong>All approved consumers</strong>
            </div>
          </div>

          <div>
            <label className="batch-label">Verified Readings Status</label>
            <div className="reading-health-indicator">
              <span className="dot dot-aqua" />
              <strong>100% Readings Logged</strong>
            </div>
          </div>

        </div>
        <div className="batch-progress-bar-wrap">
          <div className="batch-progress-bar" style={{ width: '100%' }} />
          <small>Bills, consumer balances, and billing notifications update automatically through the monthly scheduler.</small>
        </div>
      </div>

      {/* Bills Ledger */}
      <div className="table-tabs" style={{ marginTop: '24px' }}>
        <button
          className={billFilter === 'All' ? 'selected' : ''}
          onClick={() => setBillFilter('All')}
        >
          Active Bills <b>{bills.filter((b) => b.status !== 'Paid').length}</b>
        </button>
        <button
          className={billFilter === 'Ready' ? 'selected' : ''}
          onClick={() => setBillFilter('Ready')}
        >
          Ready for Payment <b>{readyCount}</b>
        </button>
        <button
          className={billFilter === 'Overdue' ? 'selected' : ''}
          onClick={() => setBillFilter('Overdue')}
        >
          Overdue <b className="red-count">{overdueCount}</b>
        </button>
        <button
          className={billFilter === 'Paid' ? 'selected' : ''}
          onClick={() => setBillFilter('Paid')}
        >
          Paid Consumer Log <b>{paidCount}</b>
        </button>
      </div>

      <div className="table-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Statement ID</th>
                <th>Consumer / Account</th>
                <th>Billing Period</th>
                <th>Reading (Prev → Pres)</th>
                <th>Usage</th>
                <th>Amount Due</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong className="code-badge">{b.id}</strong>
                    <small className="muted d-block">Due: {b.dueDate}</small>
                  </td>
                  <td>
                    <div className="consumer-cell">
                      <div className="avatar">{b.avatar || 'CS'}</div>
                      <div>
                        <strong>{b.name}</strong>
                        <small>{b.accountNo} · {b.zone}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="muted">{b.period}</span>
                  </td>
                  <td>
                    <span>{b.prevReading} → {b.presReading}</span>
                  </td>
                  <td>
                    <strong>{b.consumption} m³</strong>
                  </td>
                  <td>
                    <strong className="text-aqua">
                      ₱ {b.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                    {b.penalty > 0 && (
                      <small className="text-orange d-block">+₱ {b.penalty.toFixed(2)} penalty</small>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${b.status.toLowerCase()}`}>
                      <i /> {b.status}
                    </span>
                    {b.status === 'Paid' && (
                      <small className="muted d-block">
                        Paid {b.paidDate || 'recorded'}{b.receiptNo ? ` · ${b.receiptNo}` : ''}
                      </small>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions" style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                      {/* President / Admin Executive Date & Penalty Override */}
                      {isPresident && b.status !== 'Paid' && (
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => openPresidentAdjustmentModal(b)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#0284c7',
                            borderColor: '#38bdf8',
                            background: '#f0f9ff',
                            fontWeight: 700,
                          }}
                          title="Alter Due Date or Add Penalty (President Only)"
                        >
                          <Crown size={12} color="#0284c7" /> Adjust Date/Penalty
                        </button>
                      )}

                      {canRemoveBills && (
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => setBillPendingDeletion(b)}
                          aria-label={`Remove bill ${b.id} for ${b.name}`}
                          title="Remove this bill (President only)"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#b42318',
                            borderColor: '#fda29b',
                            background: '#fff5f4',
                            fontWeight: 700,
                          }}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      )}

                      <button
                        className="btn-outline-sm"
                        onClick={() => setSelectedBillForPrint(b)}
                      >
                        View SOA
                      </button>
                      {b.status !== 'Paid' && (
                        <button
                          className="btn-outline-sm btn-action"
                          onClick={() => onOpenPOS(b.accountNo)}
                        >
                          Pay at POS
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Water Utility Statement of Account (SOA) Modal */}
      {selectedBillForPrint && (
        <div className="modal-backdrop" onClick={() => setSelectedBillForPrint(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedBillForPrint(null)}>×</button>
            <div className="statement-paper">
              <div className="statement-header">
                <div>
                  <div className="brand-print">LAMBAWASA MUNICIPAL UTILITY</div>
                  <p className="statement-sub">Republic of the Philippines · Water District Operations</p>
                </div>
                <div className="statement-number-box">
                  <span>STATEMENT OF ACCOUNT</span>
                  <h3>{selectedBillForPrint.id}</h3>
                  <small>Billing Date: 03 Sep 2026</small>
                </div>
              </div>

              <div className="statement-consumer-row">
                <div>
                  <span className="label">Account Holder:</span>
                  <strong>{selectedBillForPrint.name}</strong>
                  <p>{selectedBillForPrint.accountNo} · Zone: {selectedBillForPrint.zone}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="label">Payment Due Date:</span>
                  <h4 className="text-orange">{selectedBillForPrint.dueDate}</h4>
                  <small className="muted">Please pay on or before due date to avoid 10% penalty.</small>
                </div>
              </div>

              <div className="statement-breakdown-box">
                <table className="statement-table">
                  <thead>
                    <tr>
                      <th>Meter Reading</th>
                      <th>Consumption</th>
                      <th>Base Rate</th>
                      <th>Environmental (10%)</th>
                      <th>Maintenance</th>
                      <th>Arrears / Penalties</th>
                      <th style={{ textAlign: 'right' }}>Total Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{selectedBillForPrint.prevReading} → {selectedBillForPrint.presReading}</td>
                      <td>{selectedBillForPrint.consumption} m³</td>
                      <td>₱ {selectedBillForPrint.baseAmount?.toFixed(2) || '0.00'}</td>
                      <td>₱ {selectedBillForPrint.envFee?.toFixed(2) || '0.00'}</td>
                      <td>₱ {selectedBillForPrint.maintFee?.toFixed(2) || '25.00'}</td>
                      <td>₱ {(selectedBillForPrint.arrears + selectedBillForPrint.penalty).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <strong>₱ {selectedBillForPrint.totalAmount.toFixed(2)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="statement-footer-barcode">
                <div className="barcode-mock">
                  ||| | |||| | ||| |||| | || ||| ||||||| | |||
                </div>
                <span>* {selectedBillForPrint.id} *</span>
              </div>
            </div>

            <div className="modal-action-bar">
              <button
                className="btn-secondary"
                onClick={() => flash('Statement sent to connected thermal printer')}
              >
                🖨️ Print Statement
              </button>
              {selectedBillForPrint.status !== 'Paid' && (
                <button
                  className="primary-button"
                  onClick={() => {
                    const acc = selectedBillForPrint.accountNo
                    setSelectedBillForPrint(null)
                    onOpenPOS(acc)
                  }}
                >
                  Pay Now at POS <span>→</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* President Executive Date & Penalty Adjustment Modal */}
      {editingBillForPresident && (
        <div className="modal-backdrop" onClick={() => setEditingBillForPresident(null)}>
          <div
            className="modal"
            style={{ maxWidth: '480px', borderRadius: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setEditingBillForPresident(null)}
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="modal-title-wrap">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Crown size={14} /> PRESIDENT EXECUTIVE AUTHORITY
              </div>
              <h2 style={{ margin: '4px 0', fontSize: '20px', color: '#102033' }}>
                Adjust Due Date & Penalties
              </h2>
              <p className="modal-copy" style={{ color: '#617286', fontSize: '13px' }}>
                Alter the statement deadline or assess custom penalties for <strong>{editingBillForPresident.name}</strong> ({editingBillForPresident.id}).
              </p>
            </div>

            <form onSubmit={handleSavePresidentAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div style={{ background: '#e8f0f2', padding: '12px 14px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#617286', textTransform: 'uppercase' }}>Consumer Account</span>
                  <strong style={{ display: 'block', color: '#102033', fontSize: '14px' }}>{editingBillForPresident.name}</strong>
                  <small style={{ color: '#617286' }}>{editingBillForPresident.accountNo} · {editingBillForPresident.zone}</small>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#617286', textTransform: 'uppercase' }}>Current Total</span>
                  <strong style={{ display: 'block', color: '#0284c7', fontSize: '16px' }}>₱ {editingBillForPresident.totalAmount.toFixed(2)}</strong>
                </div>
              </div>

              {/* 1. Alter Due Date */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#102033', marginBottom: '6px' }}>
                  Statement Due Date (Alteration)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="date"
                    value={overrideDueDate}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    style={{
                      width: '100%',
                      height: '46px',
                      background: '#f8fbfa',
                      border: '1.5px solid #d5e2e6',
                      borderRadius: '12px',
                      padding: '0 12px',
                      fontSize: '14px',
                      color: '#102033',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                </div>
                {overrideDueDate && parseInt(overrideDueDate.split('-')[2] || '0', 10) > 25 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#fef3c7',
                      color: '#92400e',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      marginTop: '6px',
                    }}
                  >
                    <AlertTriangle size={14} color="#d97706" /> Date is past the 25th cutoff — Account automatically flagged as OVERDUE with 10% penalty.
                  </div>
                )}
                <small style={{ color: '#617286', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                  Standard monthly cutoff is the 25th. Setting beyond 25 simulates an overdue penalty state.
                </small>
              </div>

              {/* 2. Add arrears to the current unpaid bill */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#102033', marginBottom: '6px' }}>
                  Additional Arrears to Add (PHP)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '14px', color: '#617286', fontWeight: 700 }}>₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={additionalArrears}
                    onChange={(e) => handleAdditionalArrearsChange(e.target.value)}
                    style={{
                      width: '100%',
                      height: '46px',
                      background: '#f8fbfa',
                      border: '1.5px solid #d5e2e6',
                      borderRadius: '12px',
                      padding: '0 14px 0 32px',
                      fontSize: '14px',
                      color: '#102033',
                      boxSizing: 'border-box',
                    }}
                    placeholder="0.00"
                  />
                </div>
                <small style={{ color: '#617286', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                  Added to the recorded ₱{Number(editingBillForPresident.arrears || 0).toFixed(2)} arrears on this unpaid bill.
                </small>
              </div>

              {/* 3. Add / Adjust Penalties */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#102033', marginBottom: '6px' }}>
                  Assessed Penalty (PHP)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '14px', color: '#617286', fontWeight: 700 }}>₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={overridePenalty}
                    onChange={(e) => setOverridePenalty(e.target.value)}
                    style={{
                      width: '100%',
                      height: '46px',
                      background: '#f8fbfa',
                      border: '1.5px solid #d5e2e6',
                      borderRadius: '12px',
                      padding: '0 14px 0 32px',
                      fontSize: '14px',
                      color: '#102033',
                      boxSizing: 'border-box',
                    }}
                    placeholder="0.00"
                  />
                </div>
                <small style={{ color: '#617286', fontSize: '11px', marginTop: '4px', display: 'block' }}>
                  Updated estimated balance: ₱ {(
                    editingBillForPresident.baseAmount +
                    (editingBillForPresident.arrears || 0) +
                    (Number(additionalArrears) || 0) +
                    (Number(overridePenalty) || 0) +
                    (editingBillForPresident.envFee || 0) +
                    (editingBillForPresident.maintFee || 0)
                  ).toFixed(2)}
                </small>
              </div>

              {/* 4. Reason for Adjustment */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#102033', marginBottom: '6px' }}>
                  Official Reason / Executive Memo
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    background: '#f8fbfa',
                    border: '1.5px solid #d5e2e6',
                    borderRadius: '12px',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#102033',
                    boxSizing: 'border-box',
                  }}
                  placeholder="e.g. Grace period extension, Statutory late penalty..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSavingAdjustment}
                  onClick={() => !isSavingAdjustment && setEditingBillForPresident(null)}
                  style={{ flex: 1, height: '46px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSavingAdjustment}
                  style={{
                    flex: 2,
                    height: '46px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  }}
                >
                  <Check size={16} /> {isSavingAdjustment ? 'Saving to billing…' : 'Save Executive Revision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {billPendingDeletion && (
        <div
          className="modal-backdrop"
          onClick={() => !isDeletingBill && setBillPendingDeletion(null)}
        >
          <section
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="remove-bill-title"
            aria-describedby="remove-bill-description"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: '480px', borderRadius: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ color: '#b42318', background: '#fff1f0', padding: '10px', borderRadius: '12px' }}>
                <AlertTriangle size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 id="remove-bill-title" style={{ margin: '0 0 8px', fontSize: '20px', color: '#102033' }}>
                  Remove consumer bill?
                </h2>
                <p id="remove-bill-description" style={{ margin: 0, color: '#475467', lineHeight: 1.6 }}>
                  Permanently remove bill <strong>{billPendingDeletion.id}</strong> for{' '}
                  <strong>{billPendingDeletion.name}</strong> ({billPendingDeletion.accountNo}) totaling{' '}
                  <strong>₱ {Number(billPendingDeletion.totalAmount).toFixed(2)}</strong>?
                </p>
                <p style={{ margin: '10px 0 0', color: '#b42318', fontSize: '13px', lineHeight: 1.5 }}>
                  This cannot be undone. Any linked payment records will also be removed. The meter reading will remain.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isDeletingBill}
                onClick={() => setBillPendingDeletion(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isDeletingBill}
                onClick={confirmBillRemoval}
                style={{ background: '#b42318', borderColor: '#b42318' }}
              >
                <Trash2 size={15} aria-hidden="true" /> {isDeletingBill ? 'Removing…' : 'Remove bill'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
