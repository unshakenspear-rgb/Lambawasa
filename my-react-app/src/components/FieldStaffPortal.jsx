import { useEffect, useState, useRef } from 'react'
import L from '../services/leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Compass,
  LogOut,
  Calculator,
  Gauge,
  Wrench,
  MapPin,
  Phone,
  Navigation,
  ExternalLink,
  Maximize2,
  X,
  Crosshair,
  Car,
  Layers,
} from 'lucide-react'
import './FieldStaffPortal.css'

const FIELD_MAP_CENTER = [6.429763, 124.970325]

const GOOGLE_TILE_LAYERS = {
  k: {
    name: 'Google Satellite Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
  },
  m: {
    name: 'Google Roadmap',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
  },
}

export default function FieldStaffPortal({
  currentUser,
  consumers = [],
  geoPins = [],
  clusterBoundaries = [],
  meters = [],
  complaints = [],
  pendingMeterReadings = [],
  initialTrackedTicketId = null,
  onNavigate,
  onSignOut,
}) {
  const [staffLocation, setStaffLocation] = useState(null)
  const [locationStatus, setLocationStatus] = useState('Locating staff device...')
  const [trackedTicketId, setTrackedTicketId] = useState(initialTrackedTicketId)
  const [selectedConsumerTarget, setSelectedConsumerTarget] = useState(null)
  const [mapMode, setMapMode] = useState('k') // 'k' = Satellite (hybrid), 'm' = Roadmap
  const [isNavModalOpen, setIsNavModalOpen] = useState(false)

  const open = (view) => onNavigate(view)
  const openTickets = complaints.filter((complaint) => complaint.status !== 'Resolved')
  const assignedTickets = openTickets.filter((complaint) => (
    complaint.assignedTech === currentUser?.fullName
    || complaint.assignedTo === currentUser?.fullName
    || complaint.status === 'Pending'
  ))
  const trackedTicket = assignedTickets.find((ticket) => ticket.id === trackedTicketId) || assignedTickets[0]
  const pendingReadings = pendingMeterReadings.filter((reading) => reading.status !== 'Confirmed')

  const consumerLocations = consumers
    .map((consumer) => {
      const pin = geoPins.find((item) => String(item.consumerId) === String(consumer.id))
      const latitude = Number(pin?.lat ?? pin?.latitude ?? consumer.latitude ?? consumer.requestedLatitude)
      const longitude = Number(pin?.lng ?? pin?.longitude ?? consumer.longitude ?? consumer.requestedLongitude)
      const matchingCluster = clusterBoundaries.find((cluster) => {
        const points = cluster.coordinates || []
        if (points.length < 3 || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
        let inside = false
        for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
          const current = points[index]
          const prior = points[previous]
          const intersects = ((current[1] > longitude) !== (prior[1] > longitude))
            && (latitude < ((prior[0] - current[0]) * (longitude - current[1])) / (prior[1] - current[1]) + current[0])
          if (intersects) inside = !inside
        }
        return inside
      })
      return {
        ...consumer,
        latitude,
        longitude,
        zone: matchingCluster?.name || pin?.cluster || consumer.cluster || pin?.zone || consumer.zone,
        hasLocation: Boolean(Number.isFinite(latitude) && Number.isFinite(longitude)),
      }
    })
    .sort((first, second) => (first.zone || '').localeCompare(second.zone || '') || first.name.localeCompare(second.name))

  // Geolocation tracking for live field staff
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Live GPS location unavailable')
      return undefined
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setStaffLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setLocationStatus('Live GPS location active')
      },
      () => setLocationStatus('Base Terminal (GPS offline)'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    if (initialTrackedTicketId) setTrackedTicketId(initialTrackedTicketId)
  }, [initialTrackedTicketId])

  useEffect(() => {
    if (!trackedTicket) return
    setTrackedTicketId(trackedTicket.id)
  }, [trackedTicket?.id])

  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const tileLayerRef = useRef(null)
  const routePolylineRef = useRef(null)
  const staffMarkerRef = useRef(null)
  const targetMarkerRef = useRef(null)

  const modalMapContainerRef = useRef(null)
  const modalMapInstanceRef = useRef(null)
  const modalTileLayerRef = useRef(null)
  const modalRoutePolylineRef = useRef(null)
  const modalStaffMarkerRef = useRef(null)
  const modalTargetMarkerRef = useRef(null)

  // Resolve target pin for Google Maps
  const activePin = selectedConsumerTarget
    ? geoPins.find((pin) => (
      String(pin.consumerId) === String(selectedConsumerTarget.id)
      || String(pin.accountNo) === String(selectedConsumerTarget.accountNo)
    )) || selectedConsumerTarget
    : (trackedTicket
      ? geoPins.find((pin) => (
        String(pin.consumerId) === String(trackedTicket.consumerId)
        || String(pin.accountNo) === String(trackedTicket.accountNo)
      )) || trackedTicket
      : null)

  const targetLat = Number(activePin?.lat ?? activePin?.latitude ?? selectedConsumerTarget?.latitude ?? trackedTicket?.latitude)
  const targetLng = Number(activePin?.lng ?? activePin?.longitude ?? selectedConsumerTarget?.longitude ?? trackedTicket?.longitude)
  const hasTarget = Number.isFinite(targetLat) && Number.isFinite(targetLng)

  const staffPoint = staffLocation
    ? [staffLocation.lat, staffLocation.lng]
    : FIELD_MAP_CENTER

  // Initialize and synchronize interactive Google Maps-powered Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: staffPoint,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      })

      L.control.zoom({ position: 'bottomright' }).addTo(map)

      const layerConfig = GOOGLE_TILE_LAYERS[mapMode] || GOOGLE_TILE_LAYERS.k
      tileLayerRef.current = L.tileLayer(layerConfig.url, {
        maxZoom: layerConfig.maxZoom,
        subdomains: layerConfig.subdomains,
      }).addTo(map)

      mapInstanceRef.current = map
    }
  }, [])

  // Update Tile Layer when user toggles Satellite vs Roads
  useEffect(() => {
    if (!mapInstanceRef.current) return
    const layerConfig = GOOGLE_TILE_LAYERS[mapMode] || GOOGLE_TILE_LAYERS.k
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current)
    }
    tileLayerRef.current = L.tileLayer(layerConfig.url, {
      maxZoom: layerConfig.maxZoom,
      subdomains: layerConfig.subdomains,
    }).addTo(mapInstanceRef.current)
  }, [mapMode])

  // Synchronize Markers and Directions Route Line
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Update Staff GPS Marker
    if (staffMarkerRef.current) {
      map.removeLayer(staffMarkerRef.current)
      staffMarkerRef.current = null
    }

    const staffIcon = L.divIcon({
      className: 'staff-gps-marker',
      html: `
        <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(2,132,199,0.35);animation:pulse 2s infinite;"></div>
          <div style="width:16px;height:16px;border-radius:50%;background:#0284c7;border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    })

    staffMarkerRef.current = L.marker(staffPoint, { icon: staffIcon })
      .addTo(map)
      .bindPopup(`<strong>Your Field Terminal</strong><br/>${locationStatus}`)

    // Update Target Destination Marker & Direct Route Path
    if (targetMarkerRef.current) {
      map.removeLayer(targetMarkerRef.current)
      targetMarkerRef.current = null
    }
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current)
      routePolylineRef.current = null
    }

    if (hasTarget) {
      const targetIcon = L.divIcon({
        className: 'field-dest-marker',
        html: `
          <div style="position:relative;width:32px;height:42px;display:flex;flex-direction:column;align-items:center;">
            <div style="width:32px;height:32px;border-radius:50%;background:#ef4444;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.35);color:#fff;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            </div>
            <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid #ef4444;margin-top:-2px;"></div>
          </div>
        `,
        iconSize: [32, 42],
        iconAnchor: [16, 40],
      })

      targetMarkerRef.current = L.marker([targetLat, targetLng], { icon: targetIcon })
        .addTo(map)
        .bindPopup(`<strong>${selectedConsumerTarget?.name || trackedTicket?.consumerName || 'Consumer Premise'}</strong><br/>${selectedConsumerTarget?.zone || trackedTicket?.zone || 'Tampakan Sector'}`)

      // Render crisp Route Polyline connecting staff location to consumer
      const routePoints = [staffPoint, [targetLat, targetLng]]
      routePolylineRef.current = L.polyline(routePoints, {
        color: '#0284c7',
        weight: 5,
        opacity: 0.9,
        dashArray: '8, 8',
      }).addTo(map)

      // Fit bounds nicely to both points
      const bounds = L.latLngBounds([staffPoint, [targetLat, targetLng]])
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    } else {
      map.setView(staffPoint, 14)
    }

    setTimeout(() => {
      map.invalidateSize()
    }, 200)
  }, [staffLocation, targetLat, targetLng, hasTarget, selectedConsumerTarget, trackedTicket])

  // Synchronize Fullscreen Navigation Modal Map when opened
  useEffect(() => {
    if (!isNavModalOpen) {
      if (modalMapInstanceRef.current) {
        modalMapInstanceRef.current.remove()
        modalMapInstanceRef.current = null
      }
      return
    }

    const timer = setTimeout(() => {
      if (!modalMapContainerRef.current) return

      const modalMap = L.map(modalMapContainerRef.current, {
        center: staffPoint,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      })

      L.control.zoom({ position: 'bottomright' }).addTo(modalMap)

      const layerConfig = GOOGLE_TILE_LAYERS[mapMode] || GOOGLE_TILE_LAYERS.k
      modalTileLayerRef.current = L.tileLayer(layerConfig.url, {
        maxZoom: layerConfig.maxZoom,
        subdomains: layerConfig.subdomains,
      }).addTo(modalMap)

      const staffIcon = L.divIcon({
        className: 'staff-gps-marker',
        html: `
          <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(2,132,199,0.35);animation:pulse 2s infinite;"></div>
            <div style="width:16px;height:16px;border-radius:50%;background:#0284c7;border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      L.marker(staffPoint, { icon: staffIcon })
        .addTo(modalMap)
        .bindPopup(`<strong>Your Field Terminal</strong><br/>${locationStatus}`)

      if (hasTarget) {
        const targetIcon = L.divIcon({
          className: 'field-dest-marker',
          html: `
            <div style="position:relative;width:34px;height:44px;display:flex;flex-direction:column;align-items:center;">
              <div style="width:34px;height:34px;border-radius:50%;background:#ef4444;border:2.5px solid #ffffff;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.35);color:#fff;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
              </div>
              <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #ef4444;margin-top:-2px;"></div>
            </div>
          `,
          iconSize: [34, 44],
          iconAnchor: [17, 42],
        })

        L.marker([targetLat, targetLng], { icon: targetIcon })
          .addTo(modalMap)
          .bindPopup(`<strong>${selectedConsumerTarget?.name || trackedTicket?.consumerName || 'Consumer Premise'}</strong><br/>${selectedConsumerTarget?.zone || trackedTicket?.zone || 'Tampakan Sector'}`)

        L.polyline([staffPoint, [targetLat, targetLng]], {
          color: '#0284c7',
          weight: 5,
          opacity: 0.9,
          dashArray: '8, 8',
        }).addTo(modalMap)

        const bounds = L.latLngBounds([staffPoint, [targetLat, targetLng]])
        modalMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
      } else {
        modalMap.setView(staffPoint, 14)
      }

      modalMapInstanceRef.current = modalMap
      modalMap.invalidateSize()
    }, 120)

    return () => clearTimeout(timer)
  }, [isNavModalOpen, mapMode, hasTarget, targetLat, targetLng, staffPoint, selectedConsumerTarget, trackedTicket])

  const targetName = selectedConsumerTarget?.name || trackedTicket?.consumerName || 'Lambayong Operations Center'
  const targetSubtext = selectedConsumerTarget
    ? (selectedConsumerTarget.zone || selectedConsumerTarget.cluster || 'Consumer Premise')
    : (trackedTicket ? `${trackedTicket.issueType || 'Service Inspection'} · ${trackedTicket.zone || currentUser?.zone || 'Assigned Zone'}` : 'Tampakan Operational Sector')
  const targetPhone = selectedConsumerTarget?.contact || trackedTicket?.contactNumber || trackedTicket?.contact

  // Calculate approximate road driving distance & duration
  let drivingKm = null
  let drivingMins = null
  if (hasTarget) {
    const toRad = (x) => (x * Math.PI) / 180
    const dLat = toRad(targetLat - staffPoint[0])
    const dLng = toRad(targetLng - staffPoint[1])
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(staffPoint[0])) * Math.cos(toRad(targetLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    drivingKm = ((6371 * c) * 1.25).toFixed(1)
    drivingMins = Math.max(1, Math.round((drivingKm / 35) * 60))
  }

  // Google Maps Direct URLs
  const googleMapsEmbedUrl = hasTarget
    ? `https://maps.google.com/maps?saddr=${staffPoint[0]},${staffPoint[1]}&daddr=${targetLat},${targetLng}&t=${mapMode}&output=embed`
    : `https://maps.google.com/maps?q=${FIELD_MAP_CENTER[0]},${FIELD_MAP_CENTER[1]}&z=15&t=${mapMode}&output=embed`

  const externalGoogleMapsUrl = hasTarget
    ? `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&origin=${staffPoint[0]},${staffPoint[1]}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${FIELD_MAP_CENTER[0]},${FIELD_MAP_CENTER[1]}`

  const handleSelectConsumerForNav = (consumer) => {
    setSelectedConsumerTarget(consumer)
    const mapSection = document.getElementById('field-map-title')
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleSelectJobForNav = (ticket) => {
    setTrackedTicketId(ticket.id)
    setSelectedConsumerTarget(null)
    const mapSection = document.getElementById('field-map-title')
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <main className="field-portal">
      <header className="field-portal-header">
        <div className="field-portal-brand">
          <div className="field-portal-mark" aria-hidden="true"><Compass size={18} strokeWidth={2.5} /></div>
          <div>
            <span>FIELD OPERATIONS</span>
            <strong>Lambawasa mobile desk</strong>
          </div>
        </div>
        <button type="button" className="field-portal-signout" onClick={onSignOut} aria-label="Sign out">
          <LogOut size={18} strokeWidth={2} />
        </button>
      </header>

      <section className="field-portal-welcome">
        <div>
          <span className="field-portal-eyebrow">ON DUTY · {currentUser?.zone || 'ALL SECTORS'}</span>
          <h1>Good day, {currentUser?.fullName?.split(' ')[0] || 'Technician'}.</h1>
          <p>Your field tools and assigned work, ready for the next stop.</p>
        </div>
        <div className="field-portal-status"><i /> Connected</div>
      </section>

      <section className="field-portal-priority" aria-label="Today's field summary">
        <div><strong>{assignedTickets.length}</strong><span>Assigned jobs</span></div>
        <div><strong>{pendingReadings.length}</strong><span>Readings awaiting office approval</span></div>
        <div><strong>{meters.length}</strong><span>Tracked meters</span></div>
      </section>

      <section className="field-portal-actions" aria-labelledby="field-actions-title">
        <div className="field-portal-section-head"><h2 id="field-actions-title">Field tools</h2><span>QUICK ACCESS</span></div>
        <div className="field-portal-action-grid">
          <button type="button" onClick={() => open('Consumption Calculator')}><span className="field-action-icon blue"><Calculator size={18} /></span><strong>Read meter</strong><small>Calculate usage</small></button>
          <button type="button" onClick={() => open('Meter Assets')}><span className="field-action-icon teal"><Gauge size={18} /></span><strong>My meters</strong><small>Asset records</small></button>
          <button type="button" onClick={() => open('Service Desk')}><span className="field-action-icon amber"><Wrench size={18} /></span><strong>Service jobs</strong><small>Update tickets</small></button>
          <button type="button" onClick={() => open('Geographical Mapping')}><span className="field-action-icon slate"><MapPin size={18} /></span><strong>Field map</strong><small>Find locations</small></button>
        </div>
      </section>

      {/* Direct Google Maps Section replacing Leaflet */}
      <section className="field-portal-map-section" aria-labelledby="field-map-title">
        <div className="field-portal-section-head">
          <h2 id="field-map-title">Google Maps Navigation</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button type="button" onClick={() => setIsNavModalOpen(true)} style={{ fontWeight: 700 }}>
              Expand View ⛶
            </button>
            <button type="button" onClick={() => open('Geographical Mapping')}>
              GIS Map →
            </button>
          </div>
        </div>

        <div className="field-gmap-wrapper">
          {/* Top HUD Controls */}
          <div className="field-gmap-hud">
            <div className="field-gmap-hud-info">
              <span className="field-gmap-badge">
                <Navigation size={11} /> Google GPS
              </span>
              <span className="field-gmap-hud-meta" title={targetName}>
                {hasTarget ? targetName : 'Lambayong Operations Center'}
              </span>
            </div>
            <div className="field-gmap-hud-controls">
              <button
                type="button"
                className={`field-gmap-ctrl-btn ${mapMode === 'k' ? 'active' : ''}`}
                onClick={() => setMapMode('k')}
                title="Google Satellite Hybrid View"
              >
                🛰️ Satellite
              </button>
              <button
                type="button"
                className={`field-gmap-ctrl-btn ${mapMode === 'm' ? 'active' : ''}`}
                onClick={() => setMapMode('m')}
                title="Google Roadmap View"
              >
                🗺️ Roads
              </button>
              <button
                type="button"
                className="field-gmap-ctrl-btn"
                onClick={() => setIsNavModalOpen(true)}
                title="Fullscreen In-App Navigation"
              >
                <Maximize2 size={11} />
              </button>
            </div>
          </div>

          {/* Interactive Google Map Viewport */}
          <div
            ref={mapContainerRef}
            className="field-gmap-map-canvas"
            style={{ width: '100%', height: '330px', background: '#e2e8f0' }}
          />

          {/* Bottom Route Status Bar */}
          <div className="field-gmap-footer">
            <div className="field-gmap-eta">
              <Car size={14} />
              {hasTarget ? (
                <span>
                  ~{drivingKm} km ({drivingMins} min driving) · {targetSubtext}
                </span>
              ) : (
                <span>Base Hub: Lambayong, Tampakan</span>
              )}
            </div>

            {hasTarget && (
              <a
                href={externalGoogleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="field-gmap-ext-link"
                title="Launch in Google Maps App"
              >
                Open Google Maps App <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Consumer Locations list with Quick Navigate */}
      <section className="field-portal-consumers" aria-labelledby="field-consumers-title">
        <div className="field-portal-section-head">
          <h2 id="field-consumers-title">Consumer locations</h2>
          <span>{consumerLocations.length} HOUSEHOLDS</span>
        </div>
        {consumerLocations.length > 0 ? consumerLocations.map((consumer) => {
          const isCurrentTarget = (selectedConsumerTarget?.id === consumer.id)
            || (!selectedConsumerTarget && trackedTicket && String(trackedTicket.consumerId) === String(consumer.id))
          return (
            <div
              className={`field-consumer-row ${isCurrentTarget ? 'is-active-nav' : ''}`}
              key={consumer.id || consumer.accountNo}
            >
              <span
                className={`field-consumer-location ${consumer.hasLocation ? 'is-pinned' : ''}`}
                aria-label={consumer.hasLocation ? 'Pinned location' : 'No pinned location'}
              >
                <MapPin size={14} />
              </span>
              <div
                className="field-consumer-details"
                style={{ cursor: consumer.hasLocation ? 'pointer' : 'default' }}
                onClick={() => consumer.hasLocation && handleSelectConsumerForNav(consumer)}
              >
                <strong>{consumer.name}</strong>
                <span>{consumer.zone || 'Unassigned zone'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {consumer.hasLocation && (
                  <button
                    type="button"
                    className="field-consumer-nav-btn"
                    onClick={() => handleSelectConsumerForNav(consumer)}
                    title="Direct Google Navigation to this consumer"
                  >
                    <Navigation size={10} />
                    {isCurrentTarget ? 'Routing' : 'Navigate'}
                  </button>
                )}
                <a className="field-consumer-phone" href={`tel:${consumer.contact || ''}`}>
                  <Phone size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {consumer.contact || 'No phone'}
                </a>
              </div>
            </div>
          )
        }) : (
          <div className="field-empty-state">
            <span><MapPin size={24} /></span>
            <div><strong>No consumer locations yet</strong><p>Registered household pins will appear here.</p></div>
          </div>
        )}
      </section>

      {/* Today's Queue with Quick Direct Route Selection */}
      <section className="field-portal-work" aria-labelledby="field-work-title">
        <div className="field-portal-section-head">
          <h2 id="field-work-title">Today's queue</h2>
          <button type="button" onClick={() => open('Service Desk')}>View all →</button>
        </div>
        <div className="field-tracking-status" role="status">
          <span className="field-tracking-dot" /> {locationStatus}{trackedTicket ? ` · Navigating ${targetName}` : ''}
        </div>
        {assignedTickets.length > 0 ? assignedTickets.slice(0, 3).map((ticket) => (
          <button
            type="button"
            className={`field-job-row ${trackedTicket?.id === ticket.id && !selectedConsumerTarget ? 'is-tracked' : ''}`}
            key={ticket.id}
            onClick={() => handleSelectJobForNav(ticket)}
          >
            <span className="field-job-icon">⚒</span>
            <span>
              <strong>{ticket.issueType || 'Service inspection'}</strong>
              <small>{ticket.consumerName || 'Household'} · {ticket.zone || currentUser?.zone || 'Assigned sector'}</small>
            </span>
            <em>{trackedTicket?.id === ticket.id && !selectedConsumerTarget ? 'Navigating' : ticket.status}</em>
          </button>
        )) : (
          <div className="field-empty-state">
            <span>✓</span>
            <div><strong>No open jobs assigned</strong><p>Your queue is clear for now.</p></div>
          </div>
        )}
      </section>

      {/* Fullscreen In-App Google Maps Navigation Overlay Modal */}
      {isNavModalOpen && (
        <div className="field-nav-modal-backdrop" role="dialog" aria-modal="true">
          <div className="field-nav-modal-content">
            <div className="field-nav-modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="field-gmap-badge"><Navigation size={12} /> Google GPS Console</span>
                  {hasTarget && <span style={{ fontSize: '11px', color: '#38bdf8' }}>~{drivingKm} km · {drivingMins} mins</span>}
                </div>
                <h3>{hasTarget ? targetName : 'Lambayong Operations Center'}</h3>
                <p>{targetSubtext}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className={`field-gmap-ctrl-btn ${mapMode === 'k' ? 'active' : ''}`}
                  onClick={() => setMapMode('k')}
                >
                  🛰️ Satellite
                </button>
                <button
                  type="button"
                  className={`field-gmap-ctrl-btn ${mapMode === 'm' ? 'active' : ''}`}
                  onClick={() => setMapMode('m')}
                >
                  🗺️ Roads
                </button>
                <button
                  type="button"
                  className="field-nav-modal-close"
                  onClick={() => setIsNavModalOpen(false)}
                  aria-label="Close Navigation"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              ref={modalMapContainerRef}
              className="field-nav-modal-map-canvas"
              style={{ flex: 1, width: '100%', height: '100%', background: '#e2e8f0' }}
            />

            <div className="field-nav-modal-actions">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#475569' }}>
                <Crosshair size={15} color="#0284c7" />
                <span>{locationStatus}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {targetPhone && (
                  <a
                    href={`tel:${targetPhone}`}
                    className="field-gmap-ctrl-btn"
                    style={{ background: '#0d9488', color: '#fff', borderColor: '#0d9488', padding: '6px 12px' }}
                  >
                    <Phone size={12} /> Call Consumer
                  </a>
                )}
                {hasTarget && (
                  <a
                    href={externalGoogleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="field-gmap-ctrl-btn"
                    style={{ padding: '6px 12px' }}
                  >
                    <ExternalLink size={12} /> External App
                  </a>
                )}
                <button
                  type="button"
                  className="field-gmap-ctrl-btn active"
                  style={{ padding: '6px 14px' }}
                  onClick={() => setIsNavModalOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
