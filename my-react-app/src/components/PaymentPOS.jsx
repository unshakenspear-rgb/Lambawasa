import { useState, useEffect } from 'react'

export default function PaymentPOS({
  bills,
  payments,
  prefillAccount,
  onProcessPayment,
  flash,
}) {
  const [searchTerm, setSearchTerm] = useState(prefillAccount || '')
  const [selectedBill, setSelectedBill] = useState(null)
  const [tenderedAmount, setTenderedAmount] = useState('')
  const [cashToAdd, setCashToAdd] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [cashierName] = useState('Jamie Dizon (Terminal 01)')
  const [issuedReceipt, setIssuedReceipt] = useState(null)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  // Unpaid bills eligible for payment
  const unpaidBills = bills.filter((b) => b.status !== 'Paid')

  // Effect to prefill if passed from other components
  useEffect(() => {
    if (prefillAccount) {
      setSearchTerm(prefillAccount)
      const found = bills.find(
        (b) =>
          (b.accountNo === prefillAccount || b.id === prefillAccount) &&
          b.status !== 'Paid'
      )
      if (found) {
        setSelectedBill(found)
        setTenderedAmount('')
      }
    }
  }, [prefillAccount, bills])

  const handleSearch = (term) => {
    setSearchTerm(term)
    if (!term.trim()) {
      setSelectedBill(null)
      return
    }
    const found = unpaidBills.find(
      (b) =>
        b.accountNo.toLowerCase().includes(term.toLowerCase()) ||
        b.id.toLowerCase().includes(term.toLowerCase()) ||
        b.name.toLowerCase().includes(term.toLowerCase())
    )
    if (found) {
      setSelectedBill(found)
      setTenderedAmount('')
    }
  }

  const handleSelectBill = (b) => {
    setSelectedBill(b)
    setSearchTerm(b.accountNo)
    setTenderedAmount('')
  }

  const paidForSelectedBill = selectedBill
    ? payments
      .filter((payment) => payment.billId === selectedBill.id)
      .reduce((total, payment) => total + Number(payment.amountPaid || 0), 0)
    : 0
  const dueAmount = selectedBill
    ? Math.max(0, Number((Number(selectedBill.totalAmount) - paidForSelectedBill).toFixed(2)))
    : 0
  const tenderedNum = Number(tenderedAmount) || 0
  const changeNum = Math.max(0, tenderedNum - dueAmount)
  const isInsufficient = tenderedNum < dueAmount

  const handleQuickCash = (amount) => {
    setTenderedAmount(String(amount))
  }

  const handleAddCash = (amount) => {
    const val = amount !== undefined ? Number(amount) : Number(cashToAdd)
    if (isNaN(val) || val <= 0) return
    const current = Number(tenderedAmount) || 0
    const sum = Number((current + val).toFixed(2))
    setTenderedAmount(String(sum))
    if (amount === undefined) {
      setCashToAdd('')
    }
  }

  const handleCompletePayment = async (e) => {
    e.preventDefault()
    if (!selectedBill || isProcessingPayment) return
    if (isInsufficient) {
      flash('Tendered amount is insufficient to cover total due!')
      return
    }

    const orNumber = `OR-2026-${9043 + payments.length}`
    const timestamp = new Date().toLocaleString()

    const paymentRecord = {
      id: `PAY-${3002 + payments.length}`,
      orNumber,
      billId: selectedBill.id,
      consumerId: selectedBill.consumerId,
      consumerName: selectedBill.name,
      accountNo: selectedBill.accountNo,
      amountPaid: dueAmount,
      tendered: tenderedNum,
      change: changeNum,
      method: paymentMethod,
      cashier: cashierName,
      timestamp,
    }

    setIsProcessingPayment(true)
    try {
      const paymentSaved = await onProcessPayment(selectedBill.id, paymentRecord)
      if (!paymentSaved) {
        throw new Error('Payment could not be saved. The bill remains unpaid.')
      }
      setIssuedReceipt(paymentRecord)
      setSelectedBill(null)
      setSearchTerm('')
      setTenderedAmount('')
      setCashToAdd('')
      flash(`Official Receipt ${orNumber} issued! Bill marked as PAID.`)
    } catch (error) {
      console.error('Could not complete counter payment:', error)
      flash(error.message || 'Payment could not be saved. The bill remains unpaid.')
    } finally {
      setIsProcessingPayment(false)
    }
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="feature-badge">Feature 07 · Payment P.O.S. (Point of Sale)</div>
          <h2>Counter Cashier & Instant Receipt Terminal</h2>
          <p className="subheading">
            Facilitates fast counter payments with instant receipts, automatic math verification, and real-time ledger updates.
          </p>
        </div>
        <div className="header-actions">
          <div className="cashier-badge">
            <span className="dot dot-aqua" />
            <span>Terminal: {cashierName}</span>
          </div>
        </div>
      </div>

      <div className="pos-terminal-grid">
        {/* Left Column: Payment Processing Terminal */}
        <div className="pos-counter-card">
          <div className="pos-search-box">
            <label>Scan Barcode or Search Account / Bill ID:</label>
            <div className="search-input-wrap">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Type account (e.g. ACC-88202) or consumer name..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {selectedBill ? (
            <form onSubmit={handleCompletePayment} className="pos-billing-form">
              <div className="pos-selected-banner">
                <div className="banner-left">
                  <span className="eyebrow">VERIFIED UNPAID BILL</span>
                  <h3>{selectedBill.name}</h3>
                  <p>{selectedBill.accountNo} · Statement {selectedBill.id} · {selectedBill.zone}</p>
                </div>
                <div className="banner-right">
                  <span className="label">Total Due</span>
                  <h2>₱ {dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
                </div>
              </div>

              <div className="pos-math-breakdown">
                <div className="breakdown-row">
                  <span>Usage & Base Commodity ({selectedBill.consumption} m³)</span>
                  <strong>₱ {selectedBill.baseAmount?.toFixed(2) || '0.00'}</strong>
                </div>
                <div className="breakdown-row">
                  <span>Environmental Sewerage Fee</span>
                  <strong>₱ {selectedBill.envFee?.toFixed(2) || '0.00'}</strong>
                </div>
                <div className="breakdown-row">
                  <span>Meter Maintenance Fee</span>
                  <strong>₱ {selectedBill.maintFee?.toFixed(2) || '25.00'}</strong>
                </div>
                {selectedBill.penalty > 0 && (
                  <div className="breakdown-row highlight-penalty">
                    <span>Overdue Surcharge / Late Penalty (10%)</span>
                    <strong>+₱ {selectedBill.penalty.toFixed(2)}</strong>
                  </div>
                )}
                <div className="breakdown-row total-row">
                  <strong>NET AMOUNT PAYABLE</strong>
                  <strong className="text-aqua">
                    ₱ {dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <div className="pos-payment-input-group">

                {/* User Input for Adding Money/Cash in Cash Counter */}
                <div className="add-cash-counter-box">
                  <div className="add-cash-header">
                    <span className="add-cash-title">Cash Counter Tender</span>
                    {tenderedNum > 0 && (
                      <button
                        type="button"
                        className="text-btn-clear"
                        onClick={() => {
                          setTenderedAmount('')
                          setCashToAdd('')
                        }}
                      >
                        Reset (₱ 0.00)
                      </button>
                    )}
                  </div>

                  <div className="tendered-status-row">
                    <span>Cash Tendered:</span>
                    <strong className={isInsufficient ? 'tendered-amount-pending' : 'tendered-amount-ok'}>
                      ₱ {tenderedNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div className="add-cash-input-row">
                    <div className="add-cash-input-wrapper">
                      <span className="cash-prefix">₱</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Enter amount to add..."
                        value={cashToAdd}
                        onChange={(e) => setCashToAdd(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCash()
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="add-cash-btn"
                      onClick={() => handleAddCash()}
                      disabled={!cashToAdd || Number(cashToAdd) <= 0}
                    >
                      + Add Cash
                    </button>
                  </div>

                  {/* Common Bill Denominations & Exact */}
                  <div className="add-cash-chips">
                    <span className="chips-label">Quick Add:</span>
                    <button
                      type="button"
                      className="cash-chip-btn chip-exact"
                      onClick={() => handleAddCash(dueAmount)}
                    >
                      Exact (₱{dueAmount.toFixed(2)})
                    </button>
                    {[20, 50, 100, 200, 500, 1000].map((denom) => (
                      <button
                        key={denom}
                        type="button"
                        className="cash-chip-btn"
                        onClick={() => handleAddCash(denom)}
                      >
                        +₱{denom}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Automated Math Verification & Change Display */}
                <div className="pos-change-banner">
                  <span>AUTOMATIC CHANGE COMPUTATION</span>
                  <h1 className={isInsufficient ? 'text-danger' : 'text-success'}>
                    {isInsufficient
                      ? 'INSUFFICIENT TENDER'
                      : `₱ ${changeNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </h1>
                </div>

                <button
                  type="submit"
                  disabled={isInsufficient || isProcessingPayment}
                  className="primary-button full btn-lg"
                >
                  {isProcessingPayment ? 'Saving Payment...' : '✓ Confirm Payment & Issue Official Receipt'}
                </button>
              </div>
            </form>
          ) : (
            <div className="pos-unpaid-queue">
              <h4>Pending Unpaid Bills Queue ({unpaidBills.length})</h4>
              <p className="subheading">Click any account below for instant counter checkout:</p>
              <div className="unpaid-cards-list">
                {unpaidBills.map((b) => (
                  <div
                    key={b.id}
                    className="unpaid-mini-card"
                    onClick={() => handleSelectBill(b)}
                  >
                    <div>
                      <strong>{b.name}</strong>
                      <small>{b.accountNo} · {b.zone}</small>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong className="text-aqua">₱ {b.totalAmount.toFixed(2)}</strong>
                      <span className={`status-pill ${b.status.toLowerCase()}`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Recent Transactions & Official Receipts */}
        <div className="pos-history-card">
          <div className="card-title-bar">
            <h3>Recent Counter Collections</h3>
            <span className="badge-live">{payments.length} Today</span>
          </div>

          <div className="payments-receipt-list">
            {payments.map((p) => (
              <div key={p.id} className="receipt-mini-card">
                <div className="receipt-top">
                  <strong className="code-badge">{p.orNumber}</strong>
                  <span className="timestamp">{p.timestamp}</span>
                </div>
                <div className="receipt-consumer">
                  <span>Consumer: <strong>{p.consumerName}</strong> ({p.accountNo})</span>
                  <span>Method: <strong>{p.method}</strong></span>
                </div>
                <div className="receipt-money">
                  <span>Paid: <strong>₱ {p.amountPaid.toFixed(2)}</strong></span>
                  <span>Change: <strong>₱ {p.change.toFixed(2)}</strong></span>
                </div>
                <button
                  className="btn-outline-sm full"
                  style={{ marginTop: '8px' }}
                  onClick={() => setIssuedReceipt(p)}
                >
                  View Official Receipt
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Official Receipt (O.R.) Printable Modal */}
      {issuedReceipt && (
        <div className="modal-backdrop" onClick={() => setIssuedReceipt(null)}>
          <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIssuedReceipt(null)}>×</button>
            <div className="official-receipt-paper">
              <div className="or-header">
                <h3>LAMBAWASA MUNICIPAL WATERWORKS</h3>
                <p>OFFICIAL RECEIPT (REPUBLIC OF THE PHILIPPINES)</p>
                <div className="or-number-badge">
                  <span>RECEIPT NO:</span>
                  <strong>{issuedReceipt.orNumber}</strong>
                </div>
              </div>

              <div className="or-body">
                <div className="or-meta-row">
                  <span>Date & Time:</span>
                  <strong>{issuedReceipt.timestamp}</strong>
                </div>
                <div className="or-meta-row">
                  <span>Cashier / Terminal:</span>
                  <strong>{issuedReceipt.cashier}</strong>
                </div>
                <div className="or-meta-row">
                  <span>Account No:</span>
                  <strong>{issuedReceipt.accountNo}</strong>
                </div>
                <div className="or-meta-row">
                  <span>Received From:</span>
                  <strong>{issuedReceipt.consumerName}</strong>
                </div>
                <div className="or-meta-row">
                  <span>Bill Reference:</span>
                  <strong>{issuedReceipt.billId}</strong>
                </div>

                <div className="or-divider" />

                <div className="or-payment-row">
                  <span>Total Bill Amount:</span>
                  <strong>₱ {issuedReceipt.amountPaid.toFixed(2)}</strong>
                </div>
                <div className="or-payment-row">
                  <span>Payment Tender ({issuedReceipt.method}):</span>
                  <strong>₱ {issuedReceipt.tendered.toFixed(2)}</strong>
                </div>
                <div className="or-payment-row">
                  <span>Change Given:</span>
                  <strong>₱ {issuedReceipt.change.toFixed(2)}</strong>
                </div>

                <div className="or-stamp">
                  PAID IN FULL
                </div>
              </div>

              <div className="or-footer">
                <small>Thank you for keeping your water account updated.</small>
                <div className="barcode-mock">||| |||| | ||| |||| | |||</div>
              </div>
            </div>

            <div className="modal-action-bar">
              <button
                className="primary-button full"
                onClick={() => {
                  flash(`Official Receipt ${issuedReceipt.orNumber} sent to thermal receipt printer`)
                  setIssuedReceipt(null)
                }}
              >
                🖨️ Print Official Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
