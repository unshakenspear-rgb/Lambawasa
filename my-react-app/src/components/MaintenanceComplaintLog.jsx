import { useState } from 'react'

export default function MaintenanceComplaintLog({
  currentUser,
  complaints,
  consumers,
  onAddComplaint,
  onUpdateComplaintStatus,
  onTrackTicket,
  flash,
}) {
  const isOfficeStaff = ['Office Staffs', 'Administrator'].includes(currentUser?.role)
  const isFieldStaff = currentUser?.role === 'Field Staffs'
  const canLogComplaint = currentUser?.role === 'Administrator'
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [resolveModal, setResolveModal] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [resolutionImage, setResolutionImage] = useState(null) // base64 data URL

  // Form state
  const [selectedConsumerId, setSelectedConsumerId] = useState(consumers[0]?.id || '')
  const [issueType, setIssueType] = useState('Low Water Pressure')
  const [priority, setPriority] = useState('High')
  const [assignedTech, setAssignedTech] = useState('Roberto Ramos')
  const [description, setDescription] = useState('')

  const filteredComplaints = complaints.filter((c) => {
    const isVisibleToFieldStaff = !isFieldStaff || ['Pending', 'Resolved'].includes(c.status)
    const matchesSearch = `${c.ticketNo} ${c.consumerName} ${c.issueType} ${c.zone} ${c.assignedTech}`
      .toLowerCase()
      .includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter
    return isVisibleToFieldStaff && matchesSearch && matchesStatus
  })

  const handleCreateComplaint = (e) => {
    e.preventDefault()
    const cons = consumers.find((item) => item.id === selectedConsumerId)
    const newTicketNo = `SR-2026-0${183 + complaints.length}`

    const newTicket = {
      id: `TKT-${505 + complaints.length}`,
      ticketNo: newTicketNo,
      consumerId: selectedConsumerId,
      consumerName: cons ? cons.name : 'Walk-in Consumer',
      accountNo: cons ? cons.accountNo : 'ACC-GEN',
      zone: cons ? cons.zone : 'Mabuhay',
      issueType,
      priority,
      status: isFieldStaff ? 'Pending' : 'Reported',
      assignedTech: isFieldStaff ? currentUser.fullName : assignedTech,
      assignedTo: isFieldStaff ? currentUser.fullName : assignedTech,
      reportedAt: new Date().toLocaleString(),
      description: description.trim() || 'Service assistance requested.',
      notes: isFieldStaff
        ? 'Field Staff logged the complaint and marked it Pending for resolution.'
        : 'Received by Office Staff and awaiting forwarding to Field Staff.',
    }

    onAddComplaint(newTicket)
    setShowAddModal(false)
    setDescription('')
    flash(`Support Ticket ${newTicketNo} created and assigned to ${assignedTech}`)
  }

  const handleResolveSubmit = (e) => {
    e.preventDefault()
    if (!selectedTicket) return

    onUpdateComplaintStatus(selectedTicket.id, 'Resolved', resolutionNotes || 'Repairs completed and verified by technician.', null, resolutionImage)
    setResolveModal(false)
    setSelectedTicket(null)
    setResolutionNotes('')
    setResolutionImage(null)
    flash(`Ticket ${selectedTicket.ticketNo} marked as RESOLVED!`)
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <div className="feature-badge">Feature 09 · Maintenance and Complaint Log</div>
          <h2>Report Problem & Field Repairs Log</h2>
          <p className="subheading">
            Tracks consumer support requests and service repairs from submission to resolution to improve response times and service trust.
          </p>
        </div>
        <div className="header-actions">
          {canLogComplaint && (
            <button className="primary-button" onClick={() => setShowAddModal(true)}>
              <span>＋</span> Log New Complaint / Service Request
            </button>
          )}
        </div>
      </div>

      {/* KPI stats */}
      <div className="metrics-row">
        <div className="mini-kpi-card">
          <span>Active Tickets</span>
          <strong>{complaints.filter((c) => c.status !== 'Resolved').length} Open</strong>
          <small>Field technicians deployed</small>
        </div>
        <div className="mini-kpi-card">
          <span>Urgent Attention</span>
          <strong className="text-orange">
            {complaints.filter((c) => c.priority === 'Urgent' && c.status !== 'Resolved').length}
          </strong>
          <small>Critical pressure/leak events</small>
        </div>
        <div className="mini-kpi-card">
          <span>Resolved This Cycle</span>
          <strong className="text-success">
            {complaints.filter((c) => c.status === 'Resolved').length} Completed
          </strong>
          <small>Customer sign-off logged</small>
        </div>
        <div className="mini-kpi-card">
          <span>Avg Response Time</span>
          <strong className="text-aqua">42 mins</strong>
          <small>From call to dispatch</small>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search tickets by consumer, issue, technician, zone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Statuses</option>
            <option value="Reported">Reported</option>
            <option value="Pending">Pending</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="table-card">
        {/* Mobile View: Service Ticket Cards */}
        <div className="mobile-tickets-cards-list">
          {filteredComplaints.map((c) => (
            <div key={c.id} className="mobile-service-ticket-card">
              <div className="ticket-card-header">
                <div>
                  <strong className="code-badge" style={{ fontSize: '0.9rem' }}>{c.ticketNo}</strong>
                  <small className="muted d-block" style={{ marginTop: '2px' }}>{c.reportedAt}</small>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span className={`priority-badge priority-${c.priority.toLowerCase()}`}>
                    {c.priority}
                  </span>
                  <span className={`status-pill ${c.status === 'Resolved' ? 'paid' : c.status === 'Reported' ? 'overdue' : 'active'}`}>
                    <i /> {c.status}
                  </span>
                </div>
              </div>

              <div className="ticket-card-content">
                <div className="ticket-issue-type">
                  <strong>{c.issueType}</strong>
                  <p className="ticket-desc">{c.description}</p>
                </div>
                <div className="ticket-meta-grid">
                  <div>
                    <small>Consumer</small>
                    <span>{c.consumerName} ({c.zone})</span>
                  </div>
                  <div>
                    <small>{c.status === 'Reported' ? 'Queue Owner' : 'Assigned Field Tech'}</small>
                    <span>{c.assignedTech}</span>
                  </div>
                </div>
              </div>

              <div className="ticket-card-actions">
                <button
                  className="btn-outline-sm"
                  style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                  onClick={() => onTrackTicket(c)}
                >
                  Track on Field Map
                </button>
                {isFieldStaff && c.status === 'Pending' ? (
                  <>
                    <button
                      className="btn-outline-sm btn-action"
                      style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                      onClick={() => {
                        setSelectedTicket(c)
                        setResolveModal(true)
                      }}
                    >
                      ✓ Resolve
                    </button>
                  </>
                ) : isOfficeStaff && c.status === 'Reported' ? (
                  <button
                      className="btn-outline-sm"
                      style={{ flex: 1, minHeight: '38px', justifyContent: 'center' }}
                      onClick={() => {
                        onUpdateComplaintStatus(c.id, 'Pending', 'Received by Office Staff and forwarded to Field Staff.', c.assignedTech === 'Office Staff Intake' ? 'Roberto Ramos' : c.assignedTech)
                        flash(`Ticket ${c.ticketNo} forwarded to Field Staff`)
                      }}
                    >
                      Forward to Field Staff ❯
                    </button>
                ) : (
                  <button
                    className="btn-outline-sm"
                    style={{ width: '100%', minHeight: '38px', justifyContent: 'center' }}
                    onClick={() => setSelectedTicket(c)}
                  >
                    View Ticket Details
                  </button>
                )}
              </div>
            </div>
          ))}
          {filteredComplaints.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
              No maintenance complaints or service tickets found.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="desktop-tickets-table table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Ticket Ref</th>
                <th>Consumer & Zone</th>
                <th>Issue Type & Description</th>
                <th>Priority</th>
                <th>Assigned Tech</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong className="code-badge">{c.ticketNo}</strong>
                    <small className="muted d-block">{c.reportedAt}</small>
                  </td>
                  <td>
                    <strong>{c.consumerName}</strong>
                    <small className="muted d-block">{c.accountNo} · {c.zone}</small>
                  </td>
                  <td>
                    <strong>{c.issueType}</strong>
                    <p className="ticket-desc">{c.description}</p>
                  </td>
                  <td>
                    <span className={`priority-badge priority-${c.priority.toLowerCase()}`}>
                      {c.priority}
                    </span>
                  </td>
                  <td>
                    <span>{c.assignedTech}</span>
                    <small className="muted d-block">{c.notes}</small>
                  </td>
                  <td>
                    <span className={`status-pill ${c.status === 'Resolved' ? 'paid' : c.status === 'Reported' ? 'overdue' : 'active'}`}>
                      <i /> {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      <button
                        className="btn-outline-sm"
                        onClick={() => onTrackTicket(c)}
                      >
                        Track
                      </button>
                      {isFieldStaff && c.status === 'Pending' ? (
                        <>
                          <button
                            className="btn-outline-sm btn-action"
                            onClick={() => {
                              setSelectedTicket(c)
                              setResolveModal(true)
                            }}
                          >
                            Resolve
                          </button>
                        </>
                      ) : isOfficeStaff && c.status === 'Reported' ? (
                        <button
                            className="btn-outline-sm"
                            onClick={() => {
                              onUpdateComplaintStatus(c.id, 'Pending', 'Received by Office Staff and forwarded to Field Staff.', c.assignedTech === 'Office Staff Intake' ? 'Roberto Ramos' : c.assignedTech)
                              flash(`Ticket ${c.ticketNo} forwarded to Field Staff`)
                            }}
                          >
                            Forward to Field Staff ❯
                          </button>
                      ) : (
                        <button
                          className="btn-outline-sm"
                          onClick={() => setSelectedTicket(c)}
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredComplaints.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No maintenance complaints or service tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log New Complaint Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">REPORT PROBLEM INTAKE</p>
              <h2>Log Maintenance Ticket</h2>
              <p className="modal-copy">Submit consumer complaint or pipeline incident for field dispatch.</p>
            </div>

            <form onSubmit={handleCreateComplaint}>
              <label>
                Consumer Account:
                <select
                  value={selectedConsumerId}
                  onChange={(e) => setSelectedConsumerId(e.target.value)}
                >
                  {consumers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.accountNo}) - {c.zone}
                    </option>
                  ))}
                </select>
              </label>

              <div className="modal-row">
                <label>
                  Issue Classification:
                  <select value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                    <option>Low Water Pressure</option>
                    <option>Pipe Leak Near Curb Stop</option>
                    <option>Meter Calibration Request</option>
                    <option>Water Discoloration Check</option>
                    <option>Defective Meter Glass / Dial Stuck</option>
                    <option>Billing Discrepancy Inquiry</option>
                  </select>
                </label>

                <label>
                  Urgency Priority:
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="Urgent">Urgent (Immediate Hazard)</option>
                    <option value="High">High (Service Impaired)</option>
                    <option value="Medium">Medium (Routine Service)</option>
                    <option value="Low">Low (Administrative Check)</option>
                  </select>
                </label>
              </div>

              <label>
                Assigned Lead Technician:
                <select value={assignedTech} onChange={(e) => setAssignedTech(e.target.value)}>
                  <option>Roberto Ramos (Field Team Alpha)</option>
                  <option>Tomas Cruz (Calibration Specialist)</option>
                  <option>Gil Santos (Plumbing Technician)</option>
                  <option>Jonathan Reyes (Pressure Regulators)</option>
                </select>
              </label>

              <label>
                Problem Description & Details *
                <textarea
                  rows={3}
                  required
                  placeholder="Describe location, observations, or caller instructions..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <button type="submit" className="primary-button full">
                Dispatch Service Ticket <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Ticket Modal */}
      {resolveModal && selectedTicket && (
        <div className="modal-backdrop" onClick={() => setResolveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setResolveModal(false)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">FIELD REPAIR RESOLUTION</p>
              <h2>Close Ticket {selectedTicket.ticketNo}</h2>
              <p className="modal-copy">
                {selectedTicket.consumerName} · {selectedTicket.issueType}
              </p>
            </div>

            <form onSubmit={handleResolveSubmit}>
              <label>
                Technician Work Done & Resolution Notes *
                <textarea
                  rows={4}
                  required
                  placeholder="Describe actions taken (e.g. Replaced cracked union valve, purged mainline, tested pressure at 38 PSI)..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </label>

              <div className="notice-box">
                Resolving this ticket will record an official audit trail entry and notify the consumer profile.
              </div>

              <button type="submit" className="primary-button full">
                Complete Work Order & Close Ticket <span>✓</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Details Modal */}
      {selectedTicket && !resolveModal && (
        <div className="modal-backdrop" onClick={() => setSelectedTicket(null)}>
          <div className="modal modal-md" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedTicket(null)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">TICKET ARCHIVE</p>
              <h2>{selectedTicket.ticketNo} · Service Record</h2>
              <p className="modal-copy">{selectedTicket.reportedAt}</p>
            </div>

            <div className="audit-inspect-grid">
              <div className="inspect-item">
                <span>Consumer</span>
                <strong>{selectedTicket.consumerName}</strong>
              </div>
              <div className="inspect-item">
                <span>Account & Zone</span>
                <strong>{selectedTicket.accountNo} ({selectedTicket.zone})</strong>
              </div>
              <div className="inspect-item">
                <span>Issue Type</span>
                <strong>{selectedTicket.issueType}</strong>
              </div>
              <div className="inspect-item">
                <span>Priority</span>
                <strong>{selectedTicket.priority}</strong>
              </div>
              <div className="inspect-item span-2">
                <span>Initial Description</span>
                <p className="inspect-desc">{selectedTicket.description}</p>
              </div>
              <div className="inspect-item span-2">
                <span>Resolution Logs</span>
                <p className="inspect-desc">{selectedTicket.notes}</p>
              </div>
              <div className="inspect-item">
                <span>Lead Technician</span>
                <strong>{selectedTicket.assignedTech}</strong>
              </div>
              <div className="inspect-item">
                <span>Final Status</span>
                <strong className="text-success">✓ {selectedTicket.status}</strong>
              </div>
            </div>

            <div className="modal-action-bar">
              <button className="primary-button full" onClick={() => setSelectedTicket(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
