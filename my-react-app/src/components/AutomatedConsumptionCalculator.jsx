import { useState } from 'react'
import { calculateConsumptionBill } from '../data/mockData'
import { Footprints, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function AutomatedConsumptionCalculator({
  consumers,
  currentUser,
  onRecordMeterReading,
  onPresidentCorrectReading,
  flash,
}) {
  const [selectedConsumerId, setSelectedConsumerId] = useState(consumers[0]?.id || '')
  const [prevReading, setPrevReading] = useState(String(consumers[0]?.lastReading || 0))
  const [presReading, setPresReading] = useState('')
  const [showCorrectionConfirm, setShowCorrectionConfirm] = useState(false)
  const [isSavingCorrection, setIsSavingCorrection] = useState(false)

  const selectedConsumer = consumers.find((c) => c.id === selectedConsumerId)
  const isPresident = currentUser?.role === 'President'

  // When a consumer is selected from dropdown, update defaults
  const handleConsumerChange = (id) => {
    setSelectedConsumerId(id)
    const c = consumers.find((item) => item.id === id)
    if (c) {
      setPrevReading(String(c.lastReading || 0))
      setPresReading('')
    }
  }

  const pReadingNum = Number(prevReading) || 0
  const cReadingNum = Number(presReading) || 0
  const isNegative = presReading.trim() !== '' && cReadingNum < pReadingNum
  const isHighSpike = (cReadingNum - pReadingNum) > 50

  const calcResult = calculateConsumptionBill(
    prevReading,
    presReading
  )

  const handleSubmitReading = () => {
    if (isPresident) {
      if (!selectedConsumer || prevReading.trim() === '' || presReading.trim() === '' ||
        !Number.isFinite(pReadingNum) || !Number.isFinite(cReadingNum)) {
        flash('Enter valid previous and present meter readings before saving the correction.')
        return
      }
      if (isNegative) {
        flash('Present reading cannot be lower than the corrected previous reading.')
        return
      }
      setShowCorrectionConfirm(true)
      return
    }

    if (!selectedConsumer || presReading.trim() === '' || !Number.isFinite(cReadingNum)) {
      flash('Enter the present meter reading before submitting it for review.')
      return
    }
    if (isNegative) {
      flash('Present reading cannot be lower than the previous approved reading.')
      return
    }

    onRecordMeterReading({
      meter: { serialNo: selectedConsumer.meterNo || 'Unassigned' },
      consumer: selectedConsumer,
      previousReading: pReadingNum,
      currentReading: cReadingNum,
    })
  }

  const confirmPresidentCorrection = async () => {
    if (!selectedConsumer || !onPresidentCorrectReading || isSavingCorrection) return
    setIsSavingCorrection(true)
    try {
      const saved = await onPresidentCorrectReading({
        consumer: selectedConsumer,
        previousReading: pReadingNum,
        currentReading: cReadingNum,
      })
      if (saved) {
        setShowCorrectionConfirm(false)
        setPrevReading(String(cReadingNum))
        setPresReading('')
      }
    } finally {
      setIsSavingCorrection(false)
    }
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="feature-badge">Feature 04 · Automated Consumption Calculator</div>
          <h2>Meter Consumption & Bill Calculator</h2>
          <p className="subheading">
            Computes precise usage data for every household automatically to prevent skipping calculations and eliminate unfair billing.
          </p>
        </div>
      </div>

      <div className="calculator-layout">
        {/* Left column: Input parameters & Anomaly Alerts */}
        <div className="calculator-inputs-card">
          <div className="card-title-bar">
            <h3>Meter Reading & Parameters</h3>
            <span className="badge-live">Fixed ₱10/m³ Rate</span>
          </div>

          <div className="field-meter-route-strip">
            <span className="route-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Footprints size={14} /> {isPresident ? 'President Reading Correction' : 'Field Route Reader'}
            </span>
            <div className="route-controls">
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => {
                  const currIdx = consumers.findIndex((c) => c.id === selectedConsumerId)
                  if (currIdx > 0) handleConsumerChange(consumers[currIdx - 1].id)
                }}
                disabled={consumers.findIndex((c) => c.id === selectedConsumerId) <= 0}
              >
                ◀ Prev House
              </button>
              <span className="route-pos">
                {consumers.findIndex((c) => c.id === selectedConsumerId) + 1} of {consumers.length}
              </span>
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => {
                  const currIdx = consumers.findIndex((c) => c.id === selectedConsumerId)
                  if (currIdx >= 0 && currIdx < consumers.length - 1) handleConsumerChange(consumers[currIdx + 1].id)
                }}
                disabled={consumers.findIndex((c) => c.id === selectedConsumerId) >= consumers.length - 1}
              >
                Next House ▶
              </button>
            </div>
          </div>

          <label>
            Select Consumer Account:
            <select
              value={selectedConsumerId}
              onChange={(e) => handleConsumerChange(e.target.value)}
            >
              {consumers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.accountNo}) - {c.zone}
                </option>
              ))}
            </select>
          </label>

          <div className="calc-row-two">
            <label>
              Account Classification:
              <input
                disabled
                value={selectedConsumer?.classification || 'Residential'}
                className="disabled-input"
              />
            </label>

            <label>
              Assigned Meter Serial:
              <input
                disabled
                value={selectedConsumer ? selectedConsumer.meterNo : 'MTR-AUTO'}
                className="disabled-input"
              />
            </label>
          </div>

          <div className="calc-row-two">
            <label>
              Previous Meter Reading (m³):
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={prevReading}
                readOnly={!isPresident}
                onChange={(e) => isPresident && setPrevReading(e.target.value)}
                aria-describedby="previous-reading-help"
              />
              <small id="previous-reading-help">
                {isPresident
                  ? `President override: current approved reading is ${selectedConsumer?.lastReading ?? 0} m³.`
                  : 'Set from the last approved meter reading.'}
              </small>
            </label>

            <label>
              Present Meter Reading (m³):
              <input
                type="number"
                inputMode="decimal"
                min="0"
                className="input-present-reading"
                value={presReading}
                onChange={(e) => setPresReading(e.target.value)}
              />
            </label>
          </div>

          {/* Anomaly Detection Feedback */}
          {isNegative && (
            <div className="alert-banner alert-danger">
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={15} /> Dial Inversion / Rollback Anomaly:</strong>
              <p>
                Present reading is lower than previous reading. Please dispatch a technician to verify the physical counter or check for dial reset.
              </p>
            </div>
          )}

          {isHighSpike && !isNegative && (
            <div className="alert-banner alert-warning">
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><AlertTriangle size={15} /> High Consumption Surge Detected (+{calcResult.consumption} m³):</strong>
              <p>
                Usage is significantly above standard household threshold. Potential subterranean pipe leak or commercial overflow.
              </p>
            </div>
          )}

          {presReading.trim() === '' && (
            <div className="alert-banner">
              <strong>Enter a present meter reading to calculate consumption.</strong>
            </div>
          )}

          {presReading.trim() !== '' && !isNegative && !isHighSpike && (
            <div className="alert-banner alert-success">
              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={15} /> Reading Verified & In Range:</strong>
              <p>Consumption matches expected historical baseline (+{calcResult.consumption} m³).</p>
            </div>
          )}

          <div className="calc-action-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="primary-button full"
              disabled={isNegative || presReading.trim() === '' || (isPresident && prevReading.trim() === '')}
              onClick={handleSubmitReading}
            >
              <span>＋</span>{isPresident ? 'Save Correction & Generate Bill' : 'Submit Reading for Office Approval'}
            </button>
            <small>
              {isPresident
                ? 'Saving immediately updates the official meter reading and creates a bill. The corrected previous reading and new consumption are recorded in the audit trail.'
                : 'Readings update the consumer account and create a bill only after Office Staff approval.'}
            </small>
          </div>
        </div>

        {/* Right column: Real-time Itemized Calculation Breakdown */}
        <div className="calculator-results-card">
          <div className="card-title-bar">
            <h3>Automated Math Computation Breakdown</h3>
            <span className="cu-m-tag">Total: {calcResult.consumption} cu.m</span>
          </div>

          <div className="consumption-display">
            <div className="display-metric">
              <span>Usage Volume</span>
              <h2>{calcResult.consumption} <small>m³</small></h2>
            </div>
            <div className="display-metric right">
              <span>Computed Total</span>
              <h2 className="text-aqua">₱ {calcResult.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h2>
            </div>
          </div>

          <div className="bracket-table-wrap">
            <table className="mini-table">
              <thead>
                <tr>
                  <th>Usage Range</th>
                  <th>Usage (m³)</th>
                  <th>Rate / m³</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {calcResult.bracketBreakdown.map((b, i) => (
                  <tr key={i}>
                    <td>{b.label}</td>
                    <td>{b.cuM} m³</td>
                    <td>₱ {b.rate.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>₱ {b.amount.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="subtotal-row">
                  <td colSpan={3}>Base Commodity Charge</td>
                  <td style={{ textAlign: 'right' }}>₱ {calcResult.baseAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>
                    Environmental Sewerage Fee (10%)
                  </td>
                  <td style={{ textAlign: 'right' }}>₱ {calcResult.envFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>
                    Meter Maintenance & Watershed Care
                  </td>
                  <td style={{ textAlign: 'right' }}>₱ {calcResult.maintFee.toFixed(2)}</td>
                </tr>
                <tr className="grand-total-row">
                  <td colSpan={3}>
                    <strong>TOTAL COMPUTED BILL</strong>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <strong>₱ {calcResult.totalAmount.toFixed(2)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="audit-guarantee-note" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} style={{ flexShrink: 0, color: '#0284c7' }} />
            <span><strong>Consistent billing:</strong> The same fixed ₱10 per m³ rate and fees are applied to every approved meter reading.</span>
          </div>
        </div>
      </div>

      {showCorrectionConfirm && (
        <div className="modal-backdrop" onClick={() => !isSavingCorrection && setShowCorrectionConfirm(false)}>
          <section
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="president-reading-confirm-title"
            aria-describedby="president-reading-confirm-description"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: '500px', borderRadius: '20px' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{ color: '#a15c00', background: '#fff7e8', padding: '10px', borderRadius: '12px' }}>
                <AlertTriangle size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 id="president-reading-confirm-title" style={{ margin: '0 0 8px', fontSize: '20px', color: '#102033' }}>
                  Confirm meter correction
                </h2>
                <p id="president-reading-confirm-description" style={{ margin: 0, color: '#475467', lineHeight: 1.6 }}>
                  Save <strong>{prevReading} m³ → {presReading} m³</strong> for{' '}
                  <strong>{selectedConsumer?.name}</strong> ({selectedConsumer?.accountNo})?
                </p>
                <p style={{ margin: '10px 0 0', color: '#475467', fontSize: '13px', lineHeight: 1.5 }}>
                  This immediately changes the official meter reading to {presReading} m³ and creates a new bill for{' '}
                  <strong>{calcResult.consumption} m³</strong> of consumption. This correction will be recorded in the audit trail.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn-secondary"
                disabled={isSavingCorrection}
                onClick={() => setShowCorrectionConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={isSavingCorrection}
                onClick={confirmPresidentCorrection}
              >
                {isSavingCorrection ? 'Saving…' : 'Confirm and generate bill'}
              </button>
            </div>
          </section>
        </div>
      )}

    </div>
  )
}
