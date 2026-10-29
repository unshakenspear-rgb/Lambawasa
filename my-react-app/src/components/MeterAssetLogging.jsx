import { useState, useEffect } from 'react'
import { calculateConsumptionBill } from '../data/mockData'

export default function MeterAssetLogging({
  meters,
  consumers = [],
  bills = [],
  currentUser,
  pendingMeterReadings = [],
  onUpdateMeter,
  onAddMeter,
  onDeleteMeter,
  onRecordMeterReading,
  onConfirmMeterReading,
  onRejectMeterReading,
  initialSearch = '',
  clusterBoundaries = [],
  flash,
}) {
  const isFieldStaff = currentUser?.role === 'Field Staffs'
  const isOfficeStaff = currentUser?.role === 'Office Staffs'
  const canRemoveMeter = ['President', 'Administrator'].includes(currentUser?.role)

  // Derive zones from actual data
  const allZones = Array.from(new Set([
    ...consumers.map((c) => c.zone).filter(Boolean),
    ...clusterBoundaries.map((cl) => cl.name).filter(Boolean),
  ])).sort()
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedMeter, setSelectedMeter] = useState(null)
  const [showCalibrationModal, setShowCalibrationModal] = useState(false)
  const [showReadingModal, setShowReadingModal] = useState(false)
  const [showAddMeterModal, setShowAddMeterModal] = useState(false)
  const [reviewReading, setReviewReading] = useState(null)
  const [confirmedReceipt, setConfirmedReceipt] = useState(null)

  // Sync initialSearch if parent updates it (e.g. repeated global searches)
  useEffect(() => {
    if (initialSearch) setSearch(initialSearch)
  }, [initialSearch])

  // Calibration Form State
  const [techName, setTechName] = useState('Tomas Cruz')
  const [calNotes, setCalNotes] = useState('')
  const [calType, setCalType] = useState('Routine Calibration')
  const [calStatus, setCalStatus] = useState('Active')
  const [presentReading, setPresentReading] = useState('')

  // New Meter Form State
  const [newSerial, setNewSerial] = useState('')
  const [newBrand, setNewBrand] = useState('Aquaflow Pro')
  const [newModel, setNewModel] = useState('AF-20-Brass')
  const [newSize, setNewSize] = useState('1/2 inch')
  const [newZone, setNewZone] = useState(() => allZones[0] || '')

  const getReadingPreview = (reading) => {
    const calculation = calculateConsumptionBill(
      reading.previousReading,
      reading.currentReading
    )
    const overdueBill = bills.find((bill) => bill.consumerId === reading.consumerId && bill.status === 'Overdue')
    const penalty = overdueBill ? +((overdueBill.baseAmount + overdueBill.arrears) * 0.1).toFixed(2) : 0
    return { ...calculation, penalty, totalAmount: +(calculation.totalAmount + penalty).toFixed(2) }
  }

  const handleConfirmReading = async () => {
    if (!reviewReading) return
    const preview = getReadingPreview(reviewReading)
    const approved = await onConfirmMeterReading(reviewReading, preview)
    if (!approved) return
    setReviewReading(null)
    setConfirmedReceipt({ reading: reviewReading, ...preview })
  }

  const filteredMeters = meters.filter((m) => {
    const matchesSearch = `${m.serialNo} ${m.brand} ${m.consumerName} ${m.zone}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleSaveCalibration = (e) => {
    e.preventDefault()
    if (!selectedMeter) return

    const newHistoryEntry = {
      date: new Date().toISOString().split('T')[0],
      type: calType,
      technician: techName,
      notes: calNotes || 'Calibration performed within +/- 0.5% margin.',
    }

    const updated = {
      ...selectedMeter,
      status: calStatus,
      lastCalibration: new Date().toISOString().split('T')[0],
      nextCalibration: '2027-09-01',
      history: [newHistoryEntry, ...(selectedMeter.history || [])],
    }

    onUpdateMeter(updated)
    setSelectedMeter(updated)
    setShowCalibrationModal(false)
    setCalNotes('')
    flash(`Calibration logged for meter ${updated.serialNo}`)
  }

  const handleSaveReading = (e) => {
    e.preventDefault()
    if (!selectedMeter || !onRecordMeterReading) return
    const consumer = consumers.find((item) => item.id === selectedMeter.consumerId)
    const previousReading = Number(consumer?.lastReading || 0)
    const currentReading = Number(presentReading)
    if (presentReading.trim() === '' || !Number.isFinite(currentReading) || currentReading < previousReading) {
      flash(`Reading must be at least the previous reading of ${previousReading} m³.`)
      return
    }
    onRecordMeterReading({
      meter: selectedMeter,
      consumer,
      previousReading,
      currentReading,
    })
    setPresentReading('')
    setShowReadingModal(false)
  }

  const handleCreateMeter = (e) => {
    e.preventDefault()
    if (!newSerial.trim()) return

    const created = {
      serialNo: newSerial.trim().toUpperCase(),
      brand: newBrand,
      model: newModel,
      size: newSize,
      installDate: new Date().toISOString().split('T')[0],
      consumerId: null,
      consumerName: 'Unassigned (Inventory Stock)',
      zone: newZone,
      lastCalibration: new Date().toISOString().split('T')[0],
      nextCalibration: '2028-09-01',
      status: 'Active',
      history: [
        {
          date: new Date().toISOString().split('T')[0],
          type: 'Initial Intake',
          technician: 'Inventory Officer',
          notes: 'Tested and registered into warehouse stock.',
        },
      ],
    }

    onAddMeter(created)
    setShowAddMeterModal(false)
    setNewSerial('')
    flash(`Meter asset ${created.serialNo} registered successfully`)
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="feature-badge">Feature 02 · Meter Asset Logging</div>
          <h2>Meter Asset & Calibration Registry</h2>
          <p className="subheading">
            Maintains detailed logs of meter installations, repair schedules, and calibration histories to prevent reading inaccuracies and disputes.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-button" onClick={() => setShowAddMeterModal(true)}>
            <span>＋</span> Log New Meter
          </button>
        </div>
      </div>

      {isOfficeStaff && (
        <div className="table-card" style={{ marginBottom: '20px', padding: '16px' }}>
          <div className="card-title-bar">
            <h3>Pending Consumption Approvals</h3>
            <span className="badge-live">{pendingMeterReadings.length} Awaiting Review</span>
          </div>
          {pendingMeterReadings.length > 0 ? (
            <div className="table-responsive">
              <table className="custom-table">
                <thead><tr><th>Consumer</th><th>Meter</th><th>Previous → Current</th><th>Recorded</th><th>Action</th></tr></thead>
                <tbody>
                  {pendingMeterReadings.map((reading) => (
                    <tr key={reading.id}>
                      <td><strong>{reading.consumerName}</strong><small className="muted d-block">{reading.accountNo}</small></td>
                      <td>{reading.meterSerial}</td>
                      <td>{reading.previousReading} → {reading.currentReading} m³</td>
                      <td>{reading.recordedAt}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="primary-button" onClick={() => setReviewReading(reading)}>Review</button>
                          <button className="btn-secondary" onClick={() => onRejectMeterReading(reading)}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted" role="status">No meter readings are waiting for approval.</p>
          )}
        </div>
      )}

      {reviewReading && (
        <div className="modal-backdrop" onClick={() => setReviewReading(null)}>
          <div className="modal modal-lg" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setReviewReading(null)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">OFFICE STAFF REVIEW</p>
              <h2>Approve Meter Reading & Bill</h2>
              <p className="modal-copy">Review the recorded reading and calculated charges. Approval updates the official consumer reading and creates the bill.</p>
            </div>
            {(() => {
              const preview = getReadingPreview(reviewReading)
              return (
                <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2">
                  <div className="flex justify-between"><span>Consumer</span><strong>{reviewReading.consumerName}</strong></div>
                  <div className="flex justify-between"><span>Meter</span><strong>{reviewReading.meterSerial}</strong></div>
                  <div className="flex justify-between"><span>Previous Reading</span><strong>{reviewReading.previousReading} m³</strong></div>
                  <div className="flex justify-between"><span>Current Reading</span><strong>{reviewReading.currentReading} m³</strong></div>
                  <div className="flex justify-between"><span>Usage Summary</span><strong>{preview.consumption} m³</strong></div>
                  <div className="flex justify-between"><span>Base Charge</span><strong>₱ {preview.baseAmount.toFixed(2)}</strong></div>
                  <div className="flex justify-between"><span>Environmental Fee</span><strong>₱ {preview.envFee.toFixed(2)}</strong></div>
                  <div className="flex justify-between"><span>Maintenance Fee</span><strong>₱ {preview.maintFee.toFixed(2)}</strong></div>
                  {preview.penalty > 0 && <div className="flex justify-between font-bold text-red-600"><span>Penalty</span><strong>₱ {preview.penalty.toFixed(2)}</strong></div>}
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-base"><span>Total Payable</span><strong>₱ {preview.totalAmount.toFixed(2)}</strong></div>
                </div>
              )
            })()}
            <div className="modal-action-bar">
              <button className="btn-secondary" onClick={() => setReviewReading(null)}>Cancel</button>
              <button className="primary-button" onClick={handleConfirmReading}>Approve Reading & Create Bill</button>
            </div>
          </div>
        </div>
      )}

      {confirmedReceipt && (
        <div className="modal-backdrop" onClick={() => setConfirmedReceipt(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setConfirmedReceipt(null)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">BILL CONFIRMED</p>
              <h2>Consumption Confirmed</h2>
              <p className="modal-copy">The reading was confirmed and the consumer statement has been updated.</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <strong className="text-emerald-700 block text-lg">₱ {confirmedReceipt.totalAmount.toFixed(2)}</strong>
              <span className="text-slate-600 text-sm">{confirmedReceipt.reading.consumerName} · {confirmedReceipt.consumption} m³ consumed</span>
            </div>
            <button className="primary-button full" onClick={() => setConfirmedReceipt(null)}>Done</button>
          </div>
        </div>
      )}

      <div className="metrics-row">
        <div className="mini-kpi-card">
          <span>Total Meter Assets</span>
          <strong>{meters.length}</strong>
          <small>Active in field & warehouse</small>
        </div>
        <div className="mini-kpi-card">
          <span>Calibration Due</span>
          <strong className="text-warning">
            {meters.filter((m) => m.status === 'Calibration Due').length}
          </strong>
          <small>Needs bench testing</small>
        </div>
        <div className="mini-kpi-card">
          <span>Under Repair</span>
          <strong className="text-orange">
            {meters.filter((m) => m.status === 'Under Repair').length}
          </strong>
          <small>Dispatched for service</small>
        </div>
        <div className="mini-kpi-card">
          <span>Audit Compliance</span>
          <strong className="text-success">98.5%</strong>
          <small>Calibration validity</small>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search by serial no, brand, consumer, zone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Calibration Due">Calibration Due</option>
            <option value="Under Repair">Under Repair</option>
          </select>
        </div>
      </div>

      <div className="table-card">
        {/* Mobile View: Meter Cards */}
        <div className="mobile-meters-cards-list">
          {filteredMeters.map((m) => (
            <div key={m.serialNo} className="mobile-meter-asset-card">
              <div className="mobile-meter-header">
                <div>
                  <strong className="serial-number" style={{ fontSize: '1rem' }}>{m.serialNo}</strong>
                  <span className="spec-tag" style={{ marginLeft: '6px' }}>{m.size}</span>
                </div>
                <span
                  className={`status-pill ${
                    m.status === 'Calibration Due'
                      ? 'warning'
                      : m.status === 'Under Repair'
                      ? 'overdue'
                      : 'active'
                  }`}
                >
                  <i /> {m.status}
                </span>
              </div>

              <div className="mobile-meter-details-grid">
                <div>
                  <small>Consumer</small>
                  <strong>{m.consumerName}</strong>
                </div>
                <div>
                  <small>Zone</small>
                  <span className="zone-tag">{m.zone}</span>
                </div>
                <div>
                  <small>Model</small>
                  <span>{m.brand} {m.model}</span>
                </div>
                <div>
                  <small>Last Calibrated</small>
                  <span>{m.lastCalibration}</span>
                </div>
              </div>

              <div className="mobile-meter-actions">
                <button
                  className="btn-outline-sm"
                  style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                  onClick={() => setSelectedMeter(m)}
                >
                  Asset History
                </button>
                <button
                  className="btn-outline-sm btn-action"
                  style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                  onClick={() => {
                    setSelectedMeter(m)
                    setShowCalibrationModal(true)
                  }}
                >
                  Log Calibration
                </button>
                {isFieldStaff && m.consumerId && (
                  <button
                    className="btn-outline-sm"
                    style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                    onClick={() => {
                      const consumer = consumers.find((item) => item.id === m.consumerId)
                      setSelectedMeter(m)
                      setPresentReading(String(consumer?.lastReading || 0))
                      setShowReadingModal(true)
                    }}
                  >
                    Record Consumption
                  </button>
                )}
                {canRemoveMeter && (
                  <button
                    className="btn-outline-sm btn-danger"
                    style={{ minHeight: '38px', justifyContent: 'center' }}
                    onClick={() => {
                      if (window.confirm(`Remove meter asset ${m.serialNo} (${m.brand} ${m.model})? This permanently deletes the meter and its calibration history.`)) {
                        if (onDeleteMeter) onDeleteMeter(m)
                      }
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredMeters.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
              No meter assets match search filters.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="desktop-meters-table table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Meter Serial</th>
                <th>Brand & Model</th>
                <th>Diameter</th>
                <th>Assigned Consumer</th>
                <th>Zone</th>
                <th>Last Calibrated</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMeters.map((m) => (
                <tr key={m.serialNo}>
                  <td>
                    <strong className="serial-number">{m.serialNo}</strong>
                    <small className="muted d-block">Installed {m.installDate}</small>
                  </td>
                  <td>
                    <span>{m.brand}</span>
                    <small className="muted d-block">{m.model}</small>
                  </td>
                  <td>
                    <span className="spec-tag">{m.size}</span>
                  </td>
                  <td>
                    <strong>{m.consumerName}</strong>
                  </td>
                  <td>
                    <span className="zone-tag">{m.zone}</span>
                  </td>
                  <td>
                    <span>{m.lastCalibration}</span>
                    <small className="muted d-block">Next: {m.nextCalibration}</small>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${
                        m.status === 'Calibration Due'
                          ? 'warning'
                          : m.status === 'Under Repair'
                          ? 'overdue'
                          : 'active'
                      }`}
                    >
                      <i /> {m.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      <button
                        className="btn-outline-sm"
                        onClick={() => setSelectedMeter(m)}
                      >
                        History Log
                      </button>
                      <button
                        className="btn-outline-sm btn-action"
                        onClick={() => {
                          setSelectedMeter(m)
                          setShowCalibrationModal(true)
                        }}
                      >
                        Log Calibration
                      </button>
                      {isFieldStaff && m.consumerId && (
                        <button
                          className="btn-outline-sm"
                          onClick={() => {
                            const consumer = consumers.find((item) => item.id === m.consumerId)
                            setSelectedMeter(m)
                            setPresentReading(String(consumer?.lastReading || 0))
                            setShowReadingModal(true)
                          }}
                        >
                          Record Consumption
                        </button>
                      )}
                      {canRemoveMeter && (
                        <button
                          className="btn-outline-sm btn-danger"
                          onClick={() => {
                            if (window.confirm(`Remove meter asset ${m.serialNo} (${m.brand} ${m.model})? This permanently deletes the meter and its calibration history.`)) {
                              if (onDeleteMeter) onDeleteMeter(m)
                            }
                          }}
                        >
                          Remove
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

      {/* Meter History Modal */}
      {selectedMeter && !showCalibrationModal && (
        <div className="modal-backdrop" onClick={() => setSelectedMeter(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMeter(null)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">METER ASSET RECORD</p>
              <h2>{selectedMeter.serialNo} · Asset Lifecycle & Logs</h2>
              <p className="modal-copy">
                {selectedMeter.brand} {selectedMeter.model} ({selectedMeter.size}) · Assigned to {selectedMeter.consumerName}
              </p>
            </div>

            <div className="history-timeline">
              <h4>Calibration & Maintenance Event Timeline</h4>
              {selectedMeter.history && selectedMeter.history.length > 0 ? (
                <div className="timeline-items">
                  {selectedMeter.history.map((h, i) => (
                    <div className="timeline-item" key={i}>
                      <div className="timeline-marker" />
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <strong>{h.type}</strong>
                          <span className="timeline-date">{h.date}</span>
                        </div>
                        <p className="timeline-notes">{h.notes}</p>
                        <small className="muted">Technician in charge: {h.technician}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-cell">No prior maintenance events logged for this asset.</p>
              )}
            </div>

            <div className="modal-action-bar">
              <button
                className="btn-secondary"
                onClick={() => setShowCalibrationModal(true)}
              >
                + Log New Calibration / Service
              </button>
              {isFieldStaff && selectedMeter.consumerId && (
                <button
                  className="primary-button"
                  onClick={() => {
                    const consumer = consumers.find((item) => item.id === selectedMeter.consumerId)
                    setPresentReading(String(consumer?.lastReading || 0))
                    setShowReadingModal(true)
                  }}
                >
                  Record Consumption
                </button>
              )}
              {canRemoveMeter && (
                <button
                  className="btn-secondary"
                  style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                  onClick={() => {
                    if (window.confirm(`Remove meter asset ${selectedMeter.serialNo} (${selectedMeter.brand} ${selectedMeter.model})? This permanently deletes the meter and its calibration history.`)) {
                      if (onDeleteMeter) onDeleteMeter(selectedMeter)
                      setSelectedMeter(null)
                    }
                  }}
                >
                  Remove Meter Asset
                </button>
              )}
              <button className="primary-button" onClick={() => setSelectedMeter(null)}>
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Calibration / Service Modal */}
      {showCalibrationModal && selectedMeter && (
        <div className="modal-backdrop" onClick={() => setShowCalibrationModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowCalibrationModal(false)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">FIELD CALIBRATION</p>
              <h2>Log Service for {selectedMeter.serialNo}</h2>
              <p className="modal-copy">Record field inspection or laboratory calibration outcome.</p>
            </div>

            <form onSubmit={handleSaveCalibration}>
              <div className="modal-row">
                <label>
                  Service Event Type
                  <select value={calType} onChange={(e) => setCalType(e.target.value)}>
                    <option>Routine Calibration</option>
                    <option>Annual Audit Bench Test</option>
                    <option>Dial & Glass Seal Repair</option>
                    <option>Impeller Overhaul</option>
                    <option>Emergency Field Verification</option>
                  </select>
                </label>

                <label>
                  Updated Status
                  <select value={calStatus} onChange={(e) => setCalStatus(e.target.value)}>
                    <option value="Active">Active (Passed)</option>
                    <option value="Calibration Due">Needs Further Calibration</option>
                    <option value="Under Repair">Under Repair</option>
                    {isFieldStaff && <option value="Disconnected">Disconnected Water Supply</option>}
                  </select>
                </label>
              </div>

              <label>
                Assigned Certified Technician *
                <input
                  required
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  placeholder="e.g. Tomas Cruz"
                />
              </label>

              <label>
                Inspection Notes & Test Margins
                <textarea
                  rows={3}
                  value={calNotes}
                  onChange={(e) => setCalNotes(e.target.value)}
                  placeholder="e.g. Tested at 15 L/min; accuracy within +/- 0.4%; security tamper seal replaced."
                />
              </label>

              <button type="submit" className="primary-button full">
                Record Calibration History <span>✓</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Record Meter Consumption Modal */}
      {showReadingModal && selectedMeter && (
        <div className="modal-backdrop" onClick={() => setShowReadingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowReadingModal(false)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">FIELD METER READING</p>
              <h2>Record Consumption</h2>
              <p className="modal-copy">The new reading will calculate the consumer's current water statement automatically.</p>
            </div>
            <form onSubmit={handleSaveReading}>
              <label>
                Consumer
                <input disabled value={selectedMeter.consumerName} />
              </label>
              <div className="modal-row">
                <label>
                  Previous Reading (m³)
                  <input disabled value={consumers.find((item) => item.id === selectedMeter.consumerId)?.lastReading || 0} />
                </label>
                <label>
                  Present Reading (m³) *
                  <input
                    required
                    type="number"
                    min={consumers.find((item) => item.id === selectedMeter.consumerId)?.lastReading || 0}
                    step="0.01"
                    value={presentReading}
                    onChange={(e) => setPresentReading(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" className="primary-button full">
                Calculate & Update Water Statement <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add New Meter Asset Modal */}
      {showAddMeterModal && (
        <div className="modal-backdrop" onClick={() => setShowAddMeterModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddMeterModal(false)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">ASSET INTAKE</p>
              <h2>Log New Meter Asset</h2>
              <p className="modal-copy">Register new water meter serial into inventory.</p>
            </div>

            <form onSubmit={handleCreateMeter}>
              <label>
                Meter Serial Number *
                <input
                  required
                  placeholder="e.g. MTR-77310"
                  value={newSerial}
                  onChange={(e) => setNewSerial(e.target.value)}
                />
              </label>

              <div className="modal-row">
                <label>
                  Brand
                  <select value={newBrand} onChange={(e) => setNewBrand(e.target.value)}>
                    <option>Aquaflow Pro</option>
                    <option>HydroMaster</option>
                    <option>Zenner Commercial</option>
                    <option>Badger Meter</option>
                  </select>
                </label>

                <label>
                  Pipe Diameter
                  <select value={newSize} onChange={(e) => setNewSize(e.target.value)}>
                    <option>1/2 inch</option>
                    <option>3/4 inch</option>
                    <option>1 inch</option>
                    <option>1.5 inch</option>
                    <option>2 inch</option>
                  </select>
                </label>
              </div>

              <div className="modal-row">
                <label>
                  Model
                  <input
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="AF-20-Brass"
                  />
                </label>

                <label>
                  Deployment Zone
                  <select value={newZone} onChange={(e) => setNewZone(e.target.value)}>
                    {allZones.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </label>
              </div>

              <button type="submit" className="primary-button full">
                Register Meter Asset <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
