import { useEffect, useRef, useState } from 'react'
import L from '../services/leaflet'
import 'leaflet/dist/leaflet.css'

export default function HouseholdProfiling({
  currentUser,
  consumers,
  geoPins = [],
  onAddConsumer,
  onUpdateConsumerApproval,
  onDeleteConsumer,
  onRequestConsumerLocationChange,
  onDecideConsumerLocationChange,
  onRecordMeterReading,
  onOpenPOS,
  onOpenCalculator,
  onOpenMap,
  initialSearch = '',
  clusterBoundaries = [],
  flash,
}) {
  const canReviewApprovals = ['President', 'Administrator'].includes(currentUser?.role)
  const canRemoveConsumer = currentUser?.role === 'President'

  // Derive zones from actual data — consumers already assigned + president-drawn clusters
  const allZones = Array.from(new Set([
    ...consumers.map((c) => c.zone).filter(Boolean),
    ...clusterBoundaries.map((cl) => cl.name).filter(Boolean),
  ])).sort()
  const [search, setSearch] = useState(initialSearch)
  const [zoneFilter, setZoneFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedConsumer, setSelectedConsumer] = useState(null)
  const [editReadingVal, setEditReadingVal] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [locationDraft, setLocationDraft] = useState(null)
  const profileMapRef = useRef(null)
  const profileMapInstanceRef = useRef(null)
  const profileMarkerRef = useRef(null)

  useEffect(() => {
    if (selectedConsumer) {
      setEditReadingVal(String(selectedConsumer.lastReading ?? ''))
    }
  }, [selectedConsumer])

  // Sync initialSearch if parent updates it (e.g. repeated global searches)
  useEffect(() => {
    if (initialSearch) setSearch(initialSearch)
  }, [initialSearch])

  // Form State
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [address, setAddress] = useState('')
  const [zone, setZone] = useState(() => allZones[0] || '')
  const [classification, setClassification] = useState('Residential')
  const [meterNo, setMeterNo] = useState('')

  const filteredConsumers = consumers.filter((c) => {
    const matchesSearch = `${c.name} ${c.username || ''} ${c.accountNo} ${c.meterNo} ${c.address}`.toLowerCase().includes(search.toLowerCase())
    const matchesZone = zoneFilter === 'All' || c.zone === zoneFilter
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter
    return matchesSearch && matchesZone && matchesStatus
  })

  const selectedPin = selectedConsumer && geoPins.find((pin) => pin.consumerId === selectedConsumer.id)
  const selectedCoordinates = selectedPin && {
    lat: Number(selectedPin.lat ?? selectedPin.latitude),
    lng: Number(selectedPin.lng ?? selectedPin.longitude),
  }

  useEffect(() => {
    if (!selectedConsumer) {
      if (profileMapInstanceRef.current) profileMapInstanceRef.current.remove()
      profileMapInstanceRef.current = null
      profileMarkerRef.current = null
      return undefined
    }

    const coordinates = selectedCoordinates?.lat && selectedCoordinates?.lng
      ? selectedCoordinates
      : { lat: 6.443, lng: 124.932 }
    setLocationDraft(coordinates)

    if (!profileMapRef.current) return undefined
    const map = L.map(profileMapRef.current, { center: [coordinates.lat, coordinates.lng], zoom: 15, zoomControl: true })
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Map data &copy; Google Maps',
    }).addTo(map)

    const marker = L.marker([coordinates.lat, coordinates.lng], { draggable: true }).addTo(map)
    marker.bindTooltip('Current service location').openTooltip()
    profileMarkerRef.current = marker
    const updateDraft = (lat, lng) => {
      const next = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }
      setLocationDraft(next)
      marker.setLatLng([next.lat, next.lng])
    }
    map.on('click', (event) => updateDraft(event.latlng.lat, event.latlng.lng))
    marker.on('dragend', (event) => {
      const point = event.target.getLatLng()
      updateDraft(point.lat, point.lng)
    })
    profileMapInstanceRef.current = map
    window.setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      profileMapInstanceRef.current = null
      profileMarkerRef.current = null
    }
  }, [selectedConsumer?.id])

  const handleCreate = (e) => {
    e.preventDefault()
    if (!name.trim()) return

    const newId = `C-${1000 + consumers.length + 1}`
    const accountNo = `ACC-${88200 + consumers.length + 1}`
    const generatedMeter = meterNo.trim() || `MTR-${77290 + consumers.length + 1}`
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

    const newConsumer = {
      id: newId,
      accountNo,
      name: name.trim(),
      contact: contact.trim() || '+63 900 000 0000',
      address: address.trim() || 'Zone Street address',
      zone,
      classification,
      meterNo: generatedMeter,
      status: 'Active',
      connectionDate: new Date().toISOString().split('T')[0],
      lastReading: 0,
      avatar: initials || 'CU',
    }

    onAddConsumer(newConsumer)
    setShowAddModal(false)
    setName('')
    setContact('')
    setAddress('')
    setMeterNo('')
    flash(`Consumer ${newConsumer.name} registered with account ${accountNo}`)
  }

  const hasLocationChange = selectedCoordinates && locationDraft
    && (Math.abs(selectedCoordinates.lat - locationDraft.lat) > 0.000001
      || Math.abs(selectedCoordinates.lng - locationDraft.lng) > 0.000001)

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="feature-badge">Feature 01 · Household Profiling System</div>
          <h2>Consumer & Household Registry</h2>
          <p className="subheading">
            Manage complete and updated consumer records to ensure smooth field operations and accurate account tracking.
          </p>
        </div>
        <div className="header-actions">
          <button className="primary-button" onClick={() => setShowAddModal(true)}>
            <span>＋</span> Register Consumer
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search by name, account no, meter no, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Zone:</label>
          <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)}>
            <option value="All">All Zones</option>
            {allZones.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Rejected">Rejected</option>
            <option value="Overdue">Overdue</option>
            <option value="Disconnected">Disconnected</option>
          </select>
        </div>
      </div>

      <div className="table-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Consumer / Account</th>
                <th>Service Address</th>
                <th>Zone</th>
                <th>Classification</th>
                <th>Meter Serial</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredConsumers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="consumer-cell">
                      <div className="avatar">{c.avatar}</div>
                      <div>
                        <strong>{c.name}</strong>
                        <small>{c.accountNo}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="address-text">{c.address}</span>
                    <small className="muted d-block">{c.contact}</small>
                  </td>
                  <td>
                    <span className="zone-tag">{c.zone}</span>
                  </td>
                  <td>
                    <span className={`class-badge ${c.classification.toLowerCase()}`}>
                      {c.classification}
                    </span>
                  </td>
                  <td>
                    <code className="code-badge">{c.meterNo}</code>
                  </td>
                  <td>
                      <span className={`status-pill ${c.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      <i /> {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      <button
                        className="btn-outline-sm"
                        title="View Profile"
                        onClick={() => setSelectedConsumer(c)}
                      >
                        Profile
                      </button>
                      <button
                        className="btn-outline-sm"
                        title="Calculate Bill"
                        onClick={() => onOpenCalculator(c)}
                      >
                        Calc
                      </button>
                      <button
                        className="btn-outline-sm"
                        title="Open POS"
                        onClick={() => onOpenPOS(c.accountNo)}
                      >
                        P.O.S.
                      </button>
                      {canReviewApprovals && c.approvalStatus === 'Pending' && (
                        <>
                          <button
                            className="btn-outline-sm"
                            onClick={() => onUpdateConsumerApproval(c.id, 'Approved')}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-outline-sm"
                            onClick={() => onUpdateConsumerApproval(c.id, 'Rejected')}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {canRemoveConsumer && (
                        <button
                          className="btn-outline-sm btn-danger"
                          onClick={() => {
                            if (window.confirm(`Remove ${c.name}'s consumer account? This permanently deletes the account's billing and service records.`)) {
                              onDeleteConsumer(c)
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
              {filteredConsumers.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No consumer records matched your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Showing {filteredConsumers.length} of {consumers.length} registered households</span>
          <span className="network-ready-label">● Live Synchronization Active</span>
        </div>
      </div>

      {/* Consumer Profile Detail Modal */}
      {selectedConsumer && (
        <div className="modal-backdrop" onClick={() => setSelectedConsumer(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedConsumer(null)}>×</button>
            <div className="profile-modal-header">
              <div className="avatar avatar-lg">{selectedConsumer.avatar}</div>
              <div>
                <h2>{selectedConsumer.name}</h2>
                <p className="account-sub">{selectedConsumer.accountNo} · Connected since {selectedConsumer.connectionDate}</p>
                <span className={`status-pill ${selectedConsumer.status.toLowerCase().replace(/\s+/g, '-')}`}>
                  <i /> {selectedConsumer.status}
                </span>
              </div>
            </div>

            <div className="profile-detail-grid">
              <div className="detail-item">
                <span className="label">Contact Phone</span>
                <strong>{selectedConsumer.contact}</strong>
              </div>
              <div className="detail-item">
                <span className="label">Zone / District</span>
                <strong>{selectedConsumer.zone}</strong>
              </div>
              <div className="detail-item">
                <span className="label">Classification</span>
                <strong>{selectedConsumer.classification} Rate</strong>
              </div>
              <div className="detail-item">
                <span className="label">Assigned Water Meter</span>
                <strong>{selectedConsumer.meterNo}</strong>
              </div>
              <div className="detail-item span-2">
                <span className="label">Premise Address</span>
                <strong>{selectedConsumer.address}</strong>
              </div>
              <div className="detail-item span-2" style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="label" style={{ margin: 0, fontWeight: 700, color: '#0369a1' }}>Latest Meter Reading (Cubic Meters)</span>
                  {currentUser?.role === 'President' && (
                    <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                      Submit for Office Approval
                    </span>
                  )}
                </div>
                {currentUser?.role === 'President' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={editReadingVal}
                      onChange={(e) => setEditReadingVal(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        border: '1.5px solid #0284c7',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 700,
                        width: '120px',
                      }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>cu.m (m³)</span>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => {
                        if (onRecordMeterReading) {
                          onRecordMeterReading({
                            meter: { serialNo: selectedConsumer.meterNo || 'Unassigned' },
                            consumer: selectedConsumer,
                            currentReading: editReadingVal.trim() === '' ? Number.NaN : Number(editReadingVal),
                          })
                        }
                      }}
                    >
                      Submit Reading
                    </button>
                    <small>Submitting does not update the official reading until Office Staff approve it.</small>
                  </div>
                ) : (
                  <strong>{selectedConsumer.lastReading} cu.m</strong>
                )}
              </div>
              <div className="detail-item">
                <span className="label">Field Map Locator</span>
                <button
                  className="link-button"
                  onClick={() => {
                    setSelectedConsumer(null)
                    onOpenMap(selectedConsumer.id)
                  }}
                >
                  Locate on Spatial Map →
                </button>
              </div>
            </div>

            <div className="profile-location-section">
              <div className="profile-location-heading">
                <div>
                  <span className="label">Registered Service Location</span>
                  <strong>Drag the pin or click the map to propose a new location.</strong>
                </div>
                {selectedConsumer.locationApprovalStatus === 'Pending' && (
                  <span className="status-pill pending-approval"><i /> Location approval pending</span>
                )}
              </div>
              <div ref={profileMapRef} className="profile-location-map" />
              <small className="registration-address-status">
                Selected: {locationDraft ? `${locationDraft.lat.toFixed(6)}, ${locationDraft.lng.toFixed(6)}` : 'Loading map...'}
              </small>
              <div className="profile-location-actions">
                {hasLocationChange && (
                  <button
                    className="btn-secondary"
                    onClick={() => onRequestConsumerLocationChange(selectedConsumer.id, locationDraft)}
                  >
                    Submit Location Change for President Approval
                  </button>
                )}
                {canReviewApprovals && selectedConsumer.locationApprovalStatus === 'Pending' && (
                  <>
                    <button className="primary-button" onClick={() => onDecideConsumerLocationChange(selectedConsumer.id, 'Approved')}>
                      Approve Location
                    </button>
                    <button className="btn-secondary" onClick={() => onDecideConsumerLocationChange(selectedConsumer.id, 'Rejected')}>
                      Reject Location
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="modal-action-bar">
              {canRemoveConsumer && (
                <button
                  className="btn-secondary btn-danger"
                  onClick={() => {
                    if (window.confirm(`Remove ${selectedConsumer.name}'s consumer account? This permanently deletes the account's billing and service records.`)) {
                      setSelectedConsumer(null)
                      onDeleteConsumer(selectedConsumer)
                    }
                  }}
                >
                  Remove Account
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => {
                  setSelectedConsumer(null)
                  onOpenCalculator(selectedConsumer)
                }}
              >
                Compute Bill Statement
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  setSelectedConsumer(null)
                  onOpenPOS(selectedConsumer.accountNo)
                }}
              >
                Open POS Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Consumer Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">HOUSEHOLD PROFILING SYSTEM</p>
              <h2>Register New Consumer</h2>
              <p className="modal-copy">Create a verified household account profile in the water network.</p>
            </div>

            <form onSubmit={handleCreate}>
              <label>
                Full Name / Business Name *
                <input
                  required
                  placeholder="e.g. Maria Santos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label>
                Contact Number *
                <input
                  required
                  placeholder="e.g. +63 917 123 4567"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </label>

              <label>
                Service Premise Address *
                <input
                  required
                  placeholder="House No., Street, Subdivision"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>

              <div className="modal-row">
                <label>
                  Zone / Sector
                  <select value={zone} onChange={(e) => setZone(e.target.value)}>
                    {allZones.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Classification
                  <select value={classification} onChange={(e) => setClassification(e.target.value)}>
                    <option>Residential</option>
                    <option>Commercial</option>
                  </select>
                </label>
              </div>

              <label>
                Water Meter Serial No. (Leave empty to auto-assign)
                <input
                  placeholder="e.g. MTR-77301"
                  value={meterNo}
                  onChange={(e) => setMeterNo(e.target.value)}
                />
              </label>

              <button type="submit" className="primary-button full">
                Complete Registration <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
