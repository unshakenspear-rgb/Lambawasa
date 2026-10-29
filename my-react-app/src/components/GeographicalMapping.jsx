import { useState, useEffect, useRef } from 'react'
import L from '../services/leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Navigation,
  Compass,
  ExternalLink,
  MapPin,
  Route,
  Layers,
  Search,
  Crosshair,
  Radio,
  CheckCircle2,
  X,
  Send,
  Volume2,
  CornerUpRight,
  ArrowUp,
  Flag,
  Maximize2,
  Mountain,
  Car,
  Clock,
} from 'lucide-react'

// Google Maps Base Tile Layer URLs
const GOOGLE_MAP_LAYERS = {
  roadmap: {
    name: 'Google Roadmap',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Map data &copy; Google Maps',
  },
  satellite: {
    name: 'Google Satellite Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Imagery &copy; Google Maps',
  },
  terrain: {
    name: 'Google Terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Map data &copy; Google Maps',
  },
}

// Custom HTML DivIcon generator for Leaflet aligning with Lambawasa design system
function createCustomMarkerIcon(pin, isSelected = false, isPinningTarget = false) {
  const statusClass = pin.status ? pin.status.toLowerCase() : 'normal'
  const selectedClass = isSelected ? 'marker-selected' : ''
  const pinningClass = isPinningTarget ? 'marker-pinning-target' : ''

  // Clean vector icon aligned with app branding (No emojis)
  const isAlert = statusClass === 'issue' || statusClass === 'disconnected' || statusClass === 'overdue'
  const iconSvg = isAlert
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" stroke="none"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`

  return L.divIcon({
    className: 'custom-leaflet-marker-wrapper',
    html: `
      <div class="google-pin-marker ${statusClass} ${selectedClass} ${pinningClass}">
        <div class="google-pin-pulse"></div>
        <div class="google-pin-head">
          <span class="google-pin-icon" style="display:flex;align-items:center;justify-content:center;">${iconSvg}</span>
        </div>
        <div class="google-pin-tip"></div>
        <div class="google-pin-label">${pin.name || 'Consumer'}</div>
      </div>
    `,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -42],
  })
}

// Custom DivIcon for Searched Address Waypoint (Vector Pin)
function createSearchWaypointIcon(label) {
  const waypointSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>`
  return L.divIcon({
    className: 'custom-search-waypoint-wrapper',
    html: `
      <div class="search-waypoint-pin">
        <div class="search-pin-radar"></div>
        <div class="search-pin-head" style="display:flex;align-items:center;justify-content:center;">${waypointSvg}</div>
        <div class="search-pin-tip"></div>
        <div class="search-pin-banner">${label}</div>
      </div>
    `,
    iconSize: [38, 48],
    iconAnchor: [19, 48],
    popupAnchor: [0, -42],
  })
}

function normalizeServiceBoundary(boundary) {
  if (!boundary) return null
  if (Array.isArray(boundary.coordinates)) return boundary

  if (typeof boundary.radius === 'number') {
    const points = Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2
      const latRadius = boundary.radius / 111320
      const lngRadius = boundary.radius / (111320 * Math.cos((boundary.lat * Math.PI) / 180))
      return [
        boundary.lat + Math.sin(angle) * latRadius,
        boundary.lng + Math.cos(angle) * lngRadius,
      ]
    })
    return { type: 'polygon', coordinates: points }
  }

  const lat = (boundary.south + boundary.north) / 2
  const lng = (boundary.west + boundary.east) / 2
  const latRadius = (boundary.north - boundary.south) * 111320 / 2
  const lngRadius = (boundary.east - boundary.west) * 111320 * Math.cos((lat * Math.PI) / 180) / 2

  return {
    type: 'polygon',
    coordinates: [
      [boundary.north, lng],
      [boundary.north - (boundary.north - boundary.south) * 0.2, boundary.east],
      [boundary.south + (boundary.north - boundary.south) * 0.15, boundary.east],
      [boundary.south, lng + (boundary.east - boundary.west) * 0.15],
      [boundary.south + (boundary.north - boundary.south) * 0.1, boundary.west],
      [boundary.north - (boundary.north - boundary.south) * 0.2, boundary.west],
    ],
  }
}

function isPointInsidePolygon(point, polygon) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [currentLat, currentLng] = polygon[index]
    const [previousLat, previousLng] = polygon[previous]
    const intersects = ((currentLng > point.lng) !== (previousLng > point.lng))
      && (point.lat < ((previousLat - currentLat) * (point.lng - currentLng)) / (previousLng - currentLng) + currentLat)
    if (intersects) inside = !inside
  }
  return inside
}

export default function GeographicalMapping({
  currentUser = null,
  isFieldStaff = false,
  pins,
  consumers,
  serviceBoundary,
  onUpdateServiceBoundary,
  clusterBoundaries = [],
  onUpdateClusterBoundaries,
  canEditBoundary,
  onDispatchCrew,
  onViewConsumer,
  onUpdatePinLocation,
  trackedTicket = null,
  flash,
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersLayerRef = useRef(null)
  const tileLayerRef = useRef(null)
  const myLocationMarkerRef = useRef(null)
  const searchMarkerRef = useRef(null)
  const boundaryLayerRef = useRef(null)
  const boundaryHandlesLayerRef = useRef(null)
  const clusterHandlesLayerRef = useRef(null)
  const trackingLayerRef = useRef(null)
  const [trackingLocation, setTrackingLocation] = useState(null)
  const isFieldWorker = isFieldStaff || currentUser?.role === 'Field Staffs'

  // View & Filter State
  const [baseMapType, setBaseMapType] = useState('roadmap') // roadmap | satellite | terrain
  const [selectedZone, setSelectedZone] = useState('All')
  const [selectedPin, setSelectedPin] = useState(null)
  const [searchTrackTerm, setSearchTrackTerm] = useState('')

  // Address Geocoding Search State
  const [addressInput, setAddressInput] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchedResult, setSearchedResult] = useState(null) // { title, subtitle, lat, lng, consumer }

  // Admin Pinning Mode State
  const [isPinModeActive, setIsPinModeActive] = useState(false)
  const [consumerToPinId, setConsumerToPinId] = useState(consumers[0]?.id || '')
  const [pendingCoords, setPendingCoords] = useState(null) // { lat, lng }
  const [isBoundaryEditMode, setIsBoundaryEditMode] = useState(false)
  const [draftBoundary, setDraftBoundary] = useState(() => normalizeServiceBoundary(serviceBoundary))
  const [draftClusters, setDraftClusters] = useState(clusterBoundaries)
  const [activeBoundaryTarget, setActiveBoundaryTarget] = useState('main')
  const [newClusterName, setNewClusterName] = useState('')

  const clusterOptions = [
    'All',
    ...Array.from(new Set([
      ...draftClusters.map((cluster) => cluster.name),
      ...pins.map((pin) => pin.cluster || pin.zone),
    ].filter((name) => name && name.trim().toLowerCase() !== 'northbank'))),
  ]

  // Field Dispatch Modal State
  const [dispatchModal, setDispatchModal] = useState(false)
  const [dispatchIssue, setDispatchIssue] = useState('Immediate Leak Inspection')
  const [technician, setTechnician] = useState('Roberto Ramos')

  // GPS Live Tracking State
  const [isTrackingLiveGPS, setIsTrackingLiveGPS] = useState(false)
  const [gpsStatusText, setGpsStatusText] = useState('')
  const [activeRouteNav, setActiveRouteNav] = useState(null) // { distanceKm, durationMin, origin, destination, destinationName }
  const [isInAppNavOpen, setIsInAppNavOpen] = useState(false)
  const [navStepIndex, setNavStepIndex] = useState(0)
  const [navMapMode, setNavMapMode] = useState('k') // 'k' = Satellite (hybrid), 'm' = Roadmap

  // Direct In-App Google Maps Tools & Controls State
  const [isDirectGoogleMapActive, setIsDirectGoogleMapActive] = useState(false)
  const [googleMapsToolSearch, setGoogleMapsToolSearch] = useState('')
  const [travelMode, setTravelMode] = useState('driving')
  const [showStepDetails, setShowStepDetails] = useState(false)
  const [isBannerCollapsed, setIsBannerCollapsed] = useState(false)
  const [directGoogleMapEmbedUrl, setDirectGoogleMapEmbedUrl] = useState('')

  const handleReturnToLeaflet = () => {
    setIsDirectGoogleMapActive(false)
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize()
      }
    }, 150)
  }

  // Fallback: Launch External Google Maps app if desired
  const openInGoogleMaps = (destLat, destLng, originLat, originLng) => {
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`
    if (originLat && originLng) {
      url += `&origin=${originLat},${originLng}`
    }
    url += '&travelmode=driving'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // 1. Initialize Leaflet Map with Google Maps base layer
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const initialCenter = [6.429763, 124.970325] // Lambayong, Tampakan, South Cotabato
      const initialZoom = 13

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: true,
      })

      // Add Zoom Control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Add initial Google Maps layer
      const layerConfig = GOOGLE_MAP_LAYERS[baseMapType]
      const tileLayer = L.tileLayer(layerConfig.url, {
        maxZoom: layerConfig.maxZoom,
        subdomains: layerConfig.subdomains,
        attribution: layerConfig.attribution,
      }).addTo(map)

      tileLayerRef.current = tileLayer

      // Create Layer Group for household markers
      const markersLayer = L.layerGroup().addTo(map)
      markersLayerRef.current = markersLayer
      boundaryLayerRef.current = L.layerGroup().addTo(map)
      boundaryHandlesLayerRef.current = L.layerGroup().addTo(map)
      clusterHandlesLayerRef.current = L.layerGroup().addTo(map)
      trackingLayerRef.current = L.layerGroup().addTo(map)

      mapInstanceRef.current = map
    }
  }, [])

  useEffect(() => {
    if (!trackedTicket || !navigator.geolocation) return undefined

    const watchId = navigator.geolocation.watchPosition(
      (position) => setTrackingLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setTrackingLocation(null),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [trackedTicket?.id])

  useEffect(() => {
    if (!isBoundaryEditMode) {
      setDraftBoundary(normalizeServiceBoundary(serviceBoundary))
      setDraftClusters(clusterBoundaries)
    }
  }, [serviceBoundary, clusterBoundaries, isBoundaryEditMode])

  // Draw the irregular service area and, for admins, its draggable vertex handles.
  useEffect(() => {
    if (!mapInstanceRef.current || !boundaryLayerRef.current || !boundaryHandlesLayerRef.current || !clusterHandlesLayerRef.current || !draftBoundary) return

    boundaryLayerRef.current.clearLayers()
    boundaryHandlesLayerRef.current.clearLayers()
    clusterHandlesLayerRef.current.clearLayers()

    const map = mapInstanceRef.current
    const points = draftBoundary.coordinates || []
    if (points.length >= 3) L.polygon(points, {
      color: '#0f766e',
      weight: 2,
      fillColor: '#14b8a6',
      fillOpacity: 0.1,
      dashArray: '8 6',
      interactive: false,
    }).addTo(boundaryLayerRef.current)

    draftClusters.forEach((cluster) => {
      const clusterPoints = cluster.coordinates || []
      if (clusterPoints.length < 3) return
      L.polygon(clusterPoints, {
        color: '#2563eb',
        weight: 2,
        fillColor: '#60a5fa',
        fillOpacity: 0.16,
        dashArray: '5 4',
        interactive: false,
      }).bindTooltip(cluster.name, { sticky: true }).addTo(boundaryLayerRef.current)
    })

    if (!canEditBoundary || !isBoundaryEditMode) return

    const handleIcon = L.divIcon({
      className: 'boundary-handle-icon',
      html: '<span />',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
    const editablePoints = activeBoundaryTarget === 'main'
      ? points
      : activeBoundaryTarget === 'new'
        ? []
        : draftClusters.find((cluster) => cluster.id === activeBoundaryTarget)?.coordinates || []
    const editableLayer = activeBoundaryTarget === 'main'
      ? boundaryHandlesLayerRef.current
      : clusterHandlesLayerRef.current

    editablePoints.forEach((point, index) => {
      const marker = L.marker(point, { draggable: true, icon: handleIcon }).addTo(editableLayer)
      marker.bindTooltip(`${activeBoundaryTarget === 'main' ? 'Main boundary' : 'Cluster'} point ${index + 1}`, { direction: 'top' })
      marker.bindPopup(`
        <div class="boundary-point-popup">
          <strong>${activeBoundaryTarget === 'main' ? 'Main boundary' : 'Cluster'} point ${index + 1}</strong>
          <button type="button" class="boundary-delete-point" ${editablePoints.length <= 3 ? 'disabled' : ''}>
            ${editablePoints.length <= 3 ? 'Keep 3 points minimum' : 'Delete this point'}
          </button>
        </div>
      `)
      marker.on('popupopen', (event) => {
        const deleteButton = event.popup.getElement()?.querySelector('.boundary-delete-point')
        if (!deleteButton || editablePoints.length <= 3) return
        deleteButton.addEventListener('click', () => {
          if (activeBoundaryTarget === 'main') {
            setDraftBoundary((current) => ({ ...current, coordinates: current.coordinates.filter((_, itemIndex) => itemIndex !== index) }))
          } else {
            setDraftClusters((current) => current.map((cluster) => cluster.id === activeBoundaryTarget
              ? { ...cluster, coordinates: cluster.coordinates.filter((_, itemIndex) => itemIndex !== index) }
              : cluster))
          }
        }, { once: true })
      })
      marker.on('dragend', (event) => {
        const position = event.target.getLatLng()
        const nextPoint = [position.lat, position.lng]
        if (activeBoundaryTarget === 'main') {
          setDraftBoundary((current) => ({ ...current, coordinates: current.coordinates.map((item, itemIndex) => itemIndex === index ? nextPoint : item) }))
        } else {
          setDraftClusters((current) => current.map((cluster) => cluster.id === activeBoundaryTarget
            ? { ...cluster, coordinates: cluster.coordinates.map((item, itemIndex) => itemIndex === index ? nextPoint : item) }
            : cluster))
        }
      })
    })

    const handleMapClick = (event) => {
      const nextPoint = { lat: event.latlng.lat, lng: event.latlng.lng }
      if (activeBoundaryTarget !== 'main' && !isPointInsidePolygon(nextPoint, points)) {
        if (flash) flash('Cluster points must stay inside the main service boundary.')
        return
      }
      if (activeBoundaryTarget === 'main') {
        setDraftBoundary((current) => ({ type: 'polygon', coordinates: [...(current.coordinates || []), [nextPoint.lat, nextPoint.lng]] }))
      } else if (activeBoundaryTarget === 'new') {
        const clusterName = newClusterName.trim()
        if (!clusterName) {
          if (flash) flash('Enter a cluster name before drawing the boundary.')
          return
        }
        setDraftClusters((current) => [...current, {
          id: 'draft-cluster',
          name: clusterName,
          type: 'polygon',
          coordinates: [[nextPoint.lat, nextPoint.lng]],
        }])
        setActiveBoundaryTarget('draft-cluster')
      } else {
        setDraftClusters((current) => current.map((cluster) => cluster.id === activeBoundaryTarget
          ? { ...cluster, coordinates: [...cluster.coordinates, [nextPoint.lat, nextPoint.lng]] }
          : cluster))
      }
    }
    map.on('click', handleMapClick)

    map.getContainer().classList.add('boundary-editing')
    return () => {
      map.off('click', handleMapClick)
      map.getContainer().classList.remove('boundary-editing')
    }
  }, [draftBoundary, draftClusters, activeBoundaryTarget, canEditBoundary, isBoundaryEditMode, newClusterName, flash])

  // 2. Handle Base Map Switcher (Roadmap vs Satellite vs Terrain)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return
    const map = mapInstanceRef.current
    const layerConfig = GOOGLE_MAP_LAYERS[baseMapType]

    map.removeLayer(tileLayerRef.current)
    const newTileLayer = L.tileLayer(layerConfig.url, {
      maxZoom: layerConfig.maxZoom,
      subdomains: layerConfig.subdomains,
      attribution: layerConfig.attribution,
    }).addTo(map)

    tileLayerRef.current = newTileLayer
  }, [baseMapType])

  // 3. Render and Synchronize Household Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return
    const markersLayer = markersLayerRef.current
    markersLayer.clearLayers()

    const filteredPins = pins.filter((p) => {
      if (selectedZone === 'All') return true
      return (p.cluster || p.zone) === selectedZone
    })

    filteredPins.forEach((pin) => {
      const latitude = Number(pin.lat ?? pin.latitude)
      const longitude = Number(pin.lng ?? pin.longitude)
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return

      const isSelected = selectedPin?.id === pin.id
      const isTarget = isPinModeActive && pin.consumerId === consumerToPinId
      const markerIcon = createCustomMarkerIcon(pin, isSelected, isTarget)

      const marker = L.marker([latitude, longitude], {
        icon: markerIcon,
        draggable: isPinModeActive && pin.consumerId === consumerToPinId,
      })

      marker.on('click', () => {
        setSelectedPin(pin)
      })

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng()
        setPendingCoords({ lat: +newPos.lat.toFixed(6), lng: +newPos.lng.toFixed(6) })
        flash(`Relocated ${pin.name} pin to (${newPos.lat.toFixed(5)}, ${newPos.lng.toFixed(5)}). Click "Save Location" to confirm.`)
      })

      marker.bindTooltip(`
        <div class="google-map-tooltip">
          <strong>${pin.name}</strong>
          <small>${pin.meterNo} · ${pin.zone}</small>
          <span class="tooltip-reading">${pin.reading || 0} cu.m</span>
        </div>
      `, { direction: 'top', offset: [0, -40] })

      markersLayer.addLayer(marker)
    })
  }, [pins, selectedZone, selectedPin, isPinModeActive, consumerToPinId])

  useEffect(() => {
    const map = mapInstanceRef.current
    const trackingLayer = trackingLayerRef.current
    if (!map || !trackingLayer) return

    trackingLayer.clearLayers()
    if (!trackedTicket) return

    const targetPin = pins.find((pin) => (
      String(pin.consumerId) === String(trackedTicket.consumerId)
      || String(pin.accountNo) === String(trackedTicket.accountNo)
    ))
    const targetLat = Number(targetPin?.lat ?? targetPin?.latitude)
    const targetLng = Number(targetPin?.lng ?? targetPin?.longitude)
    if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return

    const origin = trackingLocation || { lat: 6.429763, lng: 124.970325 }
    const originPoint = [origin.lat, origin.lng]
    const targetPoint = [targetLat, targetLng]

    // Calculate approximate road distance (Haversine formula * winding road multiplier 1.25)
    const toRad = (x) => (x * Math.PI) / 180
    const dLat = toRad(targetLat - origin.lat)
    const dLng = toRad(targetLng - origin.lng)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(origin.lat)) * Math.cos(toRad(targetLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const straightDistKm = 6371 * c
    const approxDrivingKm = (straightDistKm * 1.25).toFixed(1)
    const approxDurationMins = Math.max(3, Math.round((approxDrivingKm / 35) * 60))

    setActiveRouteNav({
      originLat: origin.lat,
      originLng: origin.lng,
      destLat: targetLat,
      destLng: targetLng,
      targetName: trackedTicket.consumerName || targetPin.name || 'Reported Consumer',
      distanceKm: approxDrivingKm,
      durationMin: approxDurationMins,
      issueType: trackedTicket.issueType || 'Service inspection',
    })

    // 1. Google Navigation Route Polyline (Casing shadow + Google Blue stroke)
    L.polyline([originPoint, targetPoint], {
      color: '#0369a1',
      weight: 8,
      opacity: 0.5,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(trackingLayer)

    L.polyline([originPoint, targetPoint], {
      color: '#0284c7',
      weight: 4.5,
      opacity: 0.9,
      dashArray: '8 6',
      lineCap: 'round',
      lineJoin: 'round',
    }).bindTooltip(`Driving: ~${approxDrivingKm} km (${approxDurationMins} mins via Google GPS)`, { direction: 'center', permanent: false }).addTo(trackingLayer)

    // 2. Origin GPS Location Icon (Clean live beacon SVG)
    const originIcon = L.divIcon({
      className: 'nav-origin-marker',
      html: `
        <div style="background:#0284c7; width:26px; height:26px; border-radius:50%; border:2.5px solid #ffffff; box-shadow:0 0 12px rgba(2,132,199,0.7); display:flex; align-items:center; justify-content:center; color:#fff;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="#ffffff"/></svg>
        </div>
      `,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    })
    L.marker(originPoint, { icon: originIcon })
      .bindTooltip(trackingLocation ? 'Your Live GPS Location' : 'Field Operations Starting Point', { direction: 'top' })
      .addTo(trackingLayer)

    // 3. Highlight destination premise with a clean pulsing boundary ring (prevents duplicate marker overlap)
    L.circleMarker(targetPoint, {
      radius: 18,
      color: '#0284c7',
      weight: 2.5,
      opacity: 0.85,
      fillColor: '#38bdf8',
      fillOpacity: 0.2,
      dashArray: '4 4',
    }).bindPopup(`
      <div style="padding:6px 2px; font-family:sans-serif;">
        <strong style="color:#102033; font-size:13px;">${trackedTicket.consumerName || targetPin.name || 'Consumer'}</strong><br />
        <span style="color:#617286; font-size:11px;">${trackedTicket.issueType || 'Service report'}</span><br />
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
          <button onclick="window.__openDirectGoogleMap && window.__openDirectGoogleMap(${targetLat}, ${targetLng}, ${origin.lat}, ${origin.lng})" 
                  style="display:flex; align-items:center; justify-content:center; gap:5px; width:100%; padding:7px 10px; background:#0284c7; color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:bold; cursor:pointer;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Direct Google Map View
          </button>
        </div>
      </div>
    `).addTo(trackingLayer)

    const targetConsumerPin = pins.find((pin) => pin.id === targetPin.id)
    if (targetConsumerPin) setSelectedPin(targetConsumerPin)
    map.fitBounds([originPoint, targetPoint], { padding: [60, 60], maxZoom: 16 })
  }, [trackedTicket, trackingLocation, pins])

  // 4. Handle Map Click when Admin "Pin Mode" is Active
  useEffect(() => {
    if (!mapInstanceRef.current) return
    const map = mapInstanceRef.current

    const handleMapClick = (e) => {
      if (!isPinModeActive) return

      const { lat, lng } = e.latlng
      setPendingCoords({ lat: +lat.toFixed(6), lng: +lng.toFixed(6) })

      const targetConsumer = consumers.find((c) => c.id === consumerToPinId)
      const consumerName = targetConsumer ? targetConsumer.name : 'Consumer'

      flash(`Pinned ${consumerName} at GPS (${lat.toFixed(5)}, ${lng.toFixed(5)}). Click "Save Location" to apply.`)
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [isPinModeActive, consumerToPinId, consumers])

  // 5. Track Specific Consumer Household (Smooth Fly-To)
  const handleTrackHousehold = (consumerId) => {
    const pin = pins.find((p) => p.consumerId === consumerId)
    const consumer = consumers.find((c) => c.id === consumerId)

    // Normalise coordinates — pins may store them as lat/lng or latitude/longitude
    const lat = Number(
      pin?.lat ?? pin?.latitude ?? consumer?.latitude ?? consumer?.requestedLatitude
    )
    const lng = Number(
      pin?.lng ?? pin?.longitude ?? consumer?.longitude ?? consumer?.requestedLongitude
    )

    const hasCoords = Number.isFinite(lat) && lat !== 0 && Number.isFinite(lng) && lng !== 0

    if (!hasCoords) {
      // No coordinates yet — fly to service area center so the admin can pin them
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([6.429763, 124.970325], 15, { animate: true, duration: 1.2 })
      }
      flash(`${consumer?.name || 'Consumer'} has no location pinned yet. Use "Admin Pin" to set their coordinates.`)
      return
    }

    if (pin) setSelectedPin(pin)

    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 18, {
        animate: true,
        duration: 1.5,
      })
    }

    const label = pin?.name || consumer?.name || consumerId
    const zone = pin?.zone || consumer?.zone || ''
    flash(`Tracking ${label}'s household on the map${zone ? ` (${zone})` : ''}`)
  }

  // 6. Live Address Geocoding & Autocomplete
  const handleAddressInputChange = (val) => {
    setAddressInput(val)
    if (!val.trim()) {
      setAddressSuggestions([])
      setShowSuggestions(false)
      return
    }

    // Match local registered consumers by address, name, or zone
    const q = val.toLowerCase()
    const localMatches = consumers
      .filter((c) =>
        c.address.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.zone.toLowerCase().includes(q) ||
        c.accountNo.toLowerCase().includes(q)
      )
      .map((c) => {
        const pin = pins.find((p) => p.consumerId === c.id)
        return {
          title: c.address,
          subtitle: `${c.name} (${c.accountNo}) · ${c.zone}`,
          lat: pin?.lat || 14.5995,
          lng: pin?.lng || 121.0450,
          isConsumer: true,
          consumer: c,
        }
      })

    setAddressSuggestions(localMatches)
    setShowSuggestions(true)
  }

  // Execute Address Search (Local match + Nominatim Geocoding fallback)
  const handlePerformAddressSearch = async (e) => {
    if (e) e.preventDefault()
    if (!addressInput.trim()) return

    setIsSearchingAddress(true)
    setShowSuggestions(false)

    const q = addressInput.trim().toLowerCase()

    // Step A: Check if matches a registered consumer
    const matchedConsumer = consumers.find(
      (c) =>
        c.address.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.zone.toLowerCase().includes(q)
    )

    if (matchedConsumer) {
      const pin = pins.find((p) => p.consumerId === matchedConsumer.id)
      if (pin && pin.lat && pin.lng) {
        flyToAddressLocation(pin.lat, pin.lng, matchedConsumer.address, `${matchedConsumer.name} (${matchedConsumer.zone})`, matchedConsumer)
        setIsSearchingAddress(false)
        return
      }
    }

    // Step B: Query OpenStreetMap Nominatim Geocoder for Philippine address/streets
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput)}&countrycodes=ph&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await resp.json()

      if (data && data.length > 0) {
        const item = data[0]
        const lat = parseFloat(item.lat)
        const lng = parseFloat(item.lon)
        flyToAddressLocation(lat, lng, item.display_name.split(',')[0], item.display_name, null)
      } else {
        // Fallback to municipal sector center if query contains sector names
        let fallbackLat = 14.5995
        let fallbackLng = 121.0450
        let fallbackTitle = addressInput

        if (q.includes('riverside')) { fallbackLat = 14.5950; fallbackLng = 121.0540; }
        else if (q.includes('hillview')) { fallbackLat = 14.5820; fallbackLng = 121.0620; }
        else if (q.includes('market')) { fallbackLat = 14.5750; fallbackLng = 121.0380; }

        flyToAddressLocation(fallbackLat, fallbackLng, fallbackTitle, 'Approximate Municipal Coordinates', null)
        flash(`Navigated to approximate sector area for "${addressInput}".`)
      }
    } catch (err) {
      // Offline fallback
      flyToAddressLocation(14.5995, 121.0450, addressInput, 'District Location Center', null)
      flash(`Located area: ${addressInput}`)
    } finally {
      setIsSearchingAddress(false)
    }
  }

  // Smoothly Fly to Address Location & Place Waypoint
  const flyToAddressLocation = (lat, lng, title, subtitle, consumer) => {
    if (!mapInstanceRef.current) return
    const map = mapInstanceRef.current

    map.flyTo([lat, lng], 17, {
      animate: true,
      duration: 1.5,
    })

    // Remove previous search marker
    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current)
      searchMarkerRef.current = null
    }

    // Place high-visibility search pin
    const waypointIcon = createSearchWaypointIcon(title.slice(0, 26))
    const marker = L.marker([lat, lng], { icon: waypointIcon, zIndexOffset: 2000 })
      .addTo(map)
      .bindTooltip(`
        <div class="google-map-tooltip">
          <strong>📍 ${title}</strong>
          <small>${subtitle}</small>
          <span class="tooltip-reading">${lat.toFixed(5)}°, ${lng.toFixed(5)}°</span>
        </div>
      `, { permanent: true, direction: 'top', offset: [0, -44] })

    searchMarkerRef.current = marker

    setSearchedResult({
      title,
      subtitle,
      lat,
      lng,
      consumer,
    })

    // If matches a consumer, also select them
    if (consumer) {
      const p = pins.find((item) => item.consumerId === consumer.id)
      if (p) setSelectedPin(p)
    }

    flash(`Found and navigated to: ${title}`)
  }

  const clearSearchLocation = () => {
    if (searchMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(searchMarkerRef.current)
      searchMarkerRef.current = null
    }
    setSearchedResult(null)
    setAddressInput('')
  }

  // 7. Live GPS Field Tracking (Navigator Geolocation)
  const handleToggleLiveGPS = () => {
    if (!navigator.geolocation) {
      flash('Geolocation is not supported by your browser or environment.')
      return
    }

    if (isTrackingLiveGPS) {
      setIsTrackingLiveGPS(false)
      setGpsStatusText('')
      if (myLocationMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(myLocationMarkerRef.current)
        myLocationMarkerRef.current = null
      }
      flash('Live GPS Field Tracking disabled.')
      return
    }

    setIsTrackingLiveGPS(true)
    setGpsStatusText('Locating GPS position...')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setGpsStatusText(`GPS Accurate to ±${Math.round(accuracy)}m`)

        if (mapInstanceRef.current) {
          const map = mapInstanceRef.current
          map.flyTo([latitude, longitude], 17, { animate: true })

          if (myLocationMarkerRef.current) {
            map.removeLayer(myLocationMarkerRef.current)
          }

          const myIcon = L.divIcon({
            className: 'custom-gps-marker',
            html: `
              <div class="gps-pulse-ring"></div>
              <div class="gps-center-dot"></div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })

          const gpsMarker = L.marker([latitude, longitude], { icon: myIcon })
            .bindTooltip(`<b>📍 Your Live Field Location</b><br/>Accuracy: ±${Math.round(accuracy)}m`, { permanent: true, direction: 'top', offset: [0, -12] })
            .addTo(map)

          myLocationMarkerRef.current = gpsMarker
        }
        flash(`Live GPS locked at (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`)
      },
      (err) => {
        setIsTrackingLiveGPS(false)
        setGpsStatusText('GPS Permission denied or unavailable.')
        flash(`GPS Error: ${err.message}. Using district municipal center.`)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // 8. Save Admin Pinned Location
  const handleSavePinLocation = () => {
    if (!pendingCoords) {
      flash('Please click anywhere on the Google map to select coordinates first.')
      return
    }

    const targetConsumer = consumers.find((c) => c.id === consumerToPinId)
    if (!targetConsumer) return

    onUpdatePinLocation({
      consumerId: targetConsumer.id,
      consumerName: targetConsumer.name,
      zone: targetConsumer.zone,
      meterNo: targetConsumer.meterNo,
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
    })

    setIsPinModeActive(false)
    setPendingCoords(null)
    flash(`Success! Household location for ${targetConsumer.name} saved to database.`)
  }

  // 9. Field Dispatch Action
  const handleDispatch = (e) => {
    e.preventDefault()
    if (!selectedPin) return

    onDispatchCrew({
      consumerId: selectedPin.consumerId,
      consumerName: selectedPin.name,
      zone: selectedPin.zone,
      issueType: dispatchIssue,
      priority: 'Urgent',
      technician,
    })

    setDispatchModal(false)
    flash(`Field crew (${technician}) dispatched to ${selectedPin.name} (${selectedPin.lat?.toFixed(4)}, ${selectedPin.lng?.toFixed(4)})`)
  }

  return (
    <div className="view-container">
      {/* Header & Feature Badge */}
      <div className="view-header">
        <div>
          <div className="feature-badge">Feature 03 · Geographical Mapping</div>
          <h2>Google Maps Spatial Water Infrastructure & Address Locator</h2>
          <p className="subheading">
            Live Google base map tracking individual household connections, searching premise addresses, and enabling admin coordinate pinning.
          </p>
        </div>

        {/* Header Action Controls */}
        {(!isFieldWorker || canEditBoundary) && (
          <div className="geo-header-actions">
            {!isFieldWorker && (
              <button
                className={`btn-secondary ${isTrackingLiveGPS ? 'active-gps' : ''}`}
                onClick={handleToggleLiveGPS}
              >
                <span>📡</span> {isTrackingLiveGPS ? 'GPS Active (Tracking)' : 'Live GPS Field Locator'}
              </button>
            )}

            {canEditBoundary && (
              <button
                className={`btn-secondary ${isBoundaryEditMode ? 'active-gps' : ''}`}
                onClick={() => {
                  setIsBoundaryEditMode(!isBoundaryEditMode)
                  setActiveBoundaryTarget('main')
                  setIsPinModeActive(false)
                  setPendingCoords(null)
                }}
              >
                <span>⬡</span> {isBoundaryEditMode ? 'Stop Drawing Boundary' : 'Draw / Edit Service Boundary'}
              </button>
            )}

            {canEditBoundary && (
              <button
                className="btn-secondary"
                onClick={() => {
                  setIsBoundaryEditMode(true)
                  setActiveBoundaryTarget('new')
                  setNewClusterName('')
                  setDraftClusters((current) => current.filter((cluster) => cluster.id !== 'draft-cluster'))
                  setIsPinModeActive(false)
                  setPendingCoords(null)
                }}
              >
                <span>＋</span> Add Cluster Boundary
              </button>
            )}

            {canEditBoundary && (
              <button
                className={`primary-button ${isPinModeActive ? 'btn-pinning-active' : ''}`}
                onClick={() => {
                  setIsPinModeActive(!isPinModeActive)
                  setPendingCoords(null)
                }}
              >
                <span>📍</span> {isPinModeActive ? 'Cancel Pinning Mode' : 'Admin: Pin / Relocate Household'}
              </button>
            )}
          </div>
        )}
      </div>

      {canEditBoundary && isBoundaryEditMode && (
        <div className="boundary-edit-hud">
          <div>
            <strong>BOUNDARY EDIT MODE</strong>
            <span>Choose the main boundary or a cluster. Click the map to add points, then drag any point to refine it.</span>
          </div>
          <select
            value={activeBoundaryTarget}
            onChange={(event) => setActiveBoundaryTarget(event.target.value)}
            aria-label="Boundary to edit"
          >
            <option value="main">Main Service Boundary</option>
            {draftClusters.filter((cluster) => cluster.id !== 'draft-cluster').map((cluster) => (
              <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
            ))}
            {activeBoundaryTarget === 'draft-cluster' && <option value="draft-cluster">New Cluster</option>}
          </select>
          {(activeBoundaryTarget === 'new' || activeBoundaryTarget === 'draft-cluster') && (
            <input
              type="text"
              value={newClusterName}
              onChange={(event) => {
                const value = event.target.value
                setNewClusterName(value)
                if (activeBoundaryTarget === 'draft-cluster') {
                  setDraftClusters((current) => current.map((cluster) => cluster.id === 'draft-cluster'
                    ? { ...cluster, name: value }
                    : cluster))
                }
              }}
              placeholder="Cluster name"
              aria-label="New cluster name"
            />
          )}
          <button
            className="primary-button"
            disabled={activeBoundaryTarget === 'new'
              || (activeBoundaryTarget === 'draft-cluster' && !newClusterName.trim())
              || (activeBoundaryTarget === 'main'
                ? (draftBoundary.coordinates || []).length < 3
                : (draftClusters.find((cluster) => cluster.id === activeBoundaryTarget)?.coordinates || []).length < 3)}
            onClick={() => {
              if (activeBoundaryTarget === 'main') {
                onUpdateServiceBoundary(draftBoundary)
              } else if (onUpdateClusterBoundaries) {
                onUpdateClusterBoundaries(draftClusters.filter((cluster) => cluster.id !== 'draft-cluster' || cluster.coordinates.length >= 3))
              }
              setIsBoundaryEditMode(false)
              flash(activeBoundaryTarget === 'main' ? 'Main service boundary saved.' : 'Cluster boundaries saved.')
            }}
          >
            ✓ Save {activeBoundaryTarget === 'main' ? 'Main Boundary' : 'Cluster'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              if (activeBoundaryTarget === 'main') {
                setDraftBoundary({ type: 'polygon', coordinates: [] })
              } else if (activeBoundaryTarget === 'new') {
                setDraftClusters((current) => current.filter((cluster) => cluster.id !== 'draft-cluster'))
              } else {
                setDraftClusters((current) => current.map((cluster) => cluster.id === activeBoundaryTarget ? { ...cluster, coordinates: [] } : cluster))
              }
            }}
          >
            Redraw Selected
          </button>
        </div>
      )}

      {/* NEW: Address Search Bar with Live Geocoding */}
      <div className="address-search-card">
        <form onSubmit={handlePerformAddressSearch} className="address-search-form">
          <div className="address-input-wrapper">
            <span className="search-icon-badge">📍</span>
            <input
              type="text"
              className="address-search-input"
              placeholder="Search specific address (e.g. '15 Magsaysay St', 'Riverdale Heights', 'Hillview', or any street / landmark)..."
              value={addressInput}
              onChange={(e) => handleAddressInputChange(e.target.value)}
              onFocus={() => { if (addressSuggestions.length > 0) setShowSuggestions(true) }}
            />
            {addressInput && (
              <button
                type="button"
                className="clear-address-btn"
                onClick={() => {
                  setAddressInput('')
                  setAddressSuggestions([])
                  setShowSuggestions(false)
                }}
              >
                ✕
              </button>
            )}
          </div>

          <button type="submit" className="primary-button address-submit-btn" disabled={isSearchingAddress}>
            <span>🔍</span> {isSearchingAddress ? 'Locating...' : 'Search Address'}
          </button>
        </form>

        {/* Autocomplete Suggestions Dropdown */}
        {showSuggestions && addressSuggestions.length > 0 && (
          <div className="address-suggestions-dropdown">
            <div className="suggestions-header">
              <span>REGISTERED PREMISE MATCHES</span>
              <button onClick={() => setShowSuggestions(false)}>✕</button>
            </div>
            {addressSuggestions.map((item, idx) => (
              <div
                key={idx}
                className="suggestion-item"
                onClick={() => {
                  setAddressInput(item.title)
                  setShowSuggestions(false)
                  flyToAddressLocation(item.lat, item.lng, item.title, item.subtitle, item.consumer)
                }}
              >
                <span className="suggestion-icon">🏠</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </div>
                <span className="suggestion-badge">Locate ❯</span>
              </div>
            ))}
          </div>
        )}

        {/* Active Searched Address HUD Card */}
        {searchedResult && (
          <div className="searched-address-feedback-banner">
            <div className="feedback-left">
              <span className="badge-tag">LOCATED ADDRESS</span>
              <strong>{searchedResult.title}</strong>
              <p>{searchedResult.subtitle} · <code>{searchedResult.lat.toFixed(5)}° N, {searchedResult.lng.toFixed(5)}° E</code></p>
            </div>
            <div className="feedback-actions">
              {isPinModeActive && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setPendingCoords({ lat: searchedResult.lat, lng: searchedResult.lng })
                    flash(`Coordinates (${searchedResult.lat.toFixed(5)}, ${searchedResult.lng.toFixed(5)}) applied to selected consumer. Click "Save Location" to confirm.`)
                  }}
                >
                  📍 Pin Selected Consumer to this Address
                </button>
              )}
              <button className="btn-outline-sm" onClick={clearSearchLocation}>
                Dismiss Waypoint
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Admin Pin Mode Interactive Notification HUD */}
      {isPinModeActive && (
        <div className="admin-pin-hud-banner">
          <div className="hud-content">
            <span className="hud-badge">ADMIN PINNING MODE</span>
            <div className="hud-selector-wrap">
              <label>Select Household to Pin:</label>
              <select
                value={consumerToPinId}
                onChange={(e) => {
                  setConsumerToPinId(e.target.value)
                  setPendingCoords(null)
                }}
              >
                {consumers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.accountNo}) - {c.zone}
                  </option>
                ))}
              </select>
            </div>
            <div className="hud-instruction">
              👉 Click anywhere on the Google map, search an address, or drag an existing pin to set location.
            </div>
            {pendingCoords && (
              <div className="hud-coords">
                Lat: <code>{pendingCoords.lat.toFixed(5)}</code>, Lng: <code>{pendingCoords.lng.toFixed(5)}</code>
              </div>
            )}
          </div>
          <div className="hud-actions">
            <button
              className="primary-button"
              disabled={!pendingCoords}
              onClick={handleSavePinLocation}
            >
              ✓ Save Location to Database
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setIsPinModeActive(false)
                setPendingCoords(null)
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Map Filter, Layer Switcher & Consumer Quick Tracker Toolbar */}
      <div className="map-toolbar-bar">
        {/* Google Base Layer Switcher */}
        <div className="layer-switcher-group">
          <span className="toolbar-label">Base Layer:</span>
          <button
            className={`layer-btn ${baseMapType === 'roadmap' ? 'active' : ''}`}
            onClick={() => setBaseMapType('roadmap')}
          >
            <Layers size={13} style={{ marginRight: '5px' }} /> Roadmap
          </button>
          <button
            className={`layer-btn ${baseMapType === 'satellite' ? 'active' : ''}`}
            onClick={() => setBaseMapType('satellite')}
          >
            <Compass size={13} style={{ marginRight: '5px' }} /> Satellite Hybrid
          </button>
          <button
            className={`layer-btn ${baseMapType === 'terrain' ? 'active' : ''}`}
            onClick={() => setBaseMapType('terrain')}
          >
            <Mountain size={13} style={{ marginRight: '5px' }} /> Terrain
          </button>
        </div>

        {/* Zone Filter Buttons */}
        <div className="zone-filter-group">
          <span className="toolbar-label">Zone:</span>
          {clusterOptions.map((z) => (
            <button
              key={z}
              className={`zone-pill-btn ${selectedZone === z ? 'active' : ''}`}
              onClick={() => setSelectedZone(z)}
            >
              {z}
            </button>
          ))}
        </div>

        {/* Track User's Household Direct Search */}
        <div className="household-tracker-box">
          <span className="toolbar-label">Track Household:</span>
          <select
            value={searchTrackTerm}
            onChange={(e) => {
              setSearchTrackTerm(e.target.value)
              if (e.target.value) {
                handleTrackHousehold(e.target.value)
              }
            }}
          >
            <option value="">-- Jump to Household --</option>
            {consumers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.accountNo}) - {c.zone}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Google Maps Viewport & Inspection Sidebar */}
      <div className="map-dashboard-layout">
        {/* Main Google Leaflet Container */}
        <div className={`google-map-wrapper ${isPinModeActive ? 'cursor-crosshair' : ''}`}>
          <div ref={mapContainerRef} className="leaflet-map-canvas" />

          {/* Leaflet Mode: Collapsible, Non-Overlapping Google GPS HUD Banner */}
          {activeRouteNav && (
            <div
              className="google-gps-nav-banner"
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                zIndex: 1000,
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 10px 25px -5px rgba(16, 32, 51, 0.25)',
                border: '1.5px solid #0284c7',
                padding: isBannerCollapsed ? '8px 12px' : '14px 18px',
                maxWidth: isBannerCollapsed ? '280px' : '360px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 800,
                    letterSpacing: '0.5px',
                    color: '#0284c7',
                    textTransform: 'uppercase',
                  }}
                >
                  <Navigation size={13} /> GPS Navigation Route
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setIsBannerCollapsed(!isBannerCollapsed)}
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', color: '#617286' }}
                    title={isBannerCollapsed ? 'Expand Navigation HUD' : 'Minimize Navigation HUD'}
                  >
                    {isBannerCollapsed ? '+' : '−'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRouteNav(null)}
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#617286' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {!isBannerCollapsed && (
                <>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#102033', display: 'block' }}>
                      {activeRouteNav.targetName}
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#617286' }}>
                      {activeRouteNav.issueType}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: '#f8fafc',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '10px', color: '#617286', display: 'block', textTransform: 'uppercase' }}>Driving Distance</span>
                      <strong style={{ fontSize: '14px', color: '#0284c7' }}>{activeRouteNav.distanceKm} km</strong>
                    </div>
                    <div style={{ width: '1px', height: '24px', background: '#cbd5e1' }} />
                    <div>
                      <span style={{ fontSize: '10px', color: '#617286', display: 'block', textTransform: 'uppercase' }}>Est. Travel Time</span>
                      <strong style={{ fontSize: '14px', color: '#0d9488' }}>~{activeRouteNav.durationMin} mins</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        openInGoogleMaps(
                          activeRouteNav.destLat,
                          activeRouteNav.destLng,
                          activeRouteNav.originLat,
                          activeRouteNav.originLng
                        )
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '9px 12px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <ExternalLink size={14} /> Open in Google Maps (External)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Floating Map Overlay Legend */}
          <div className="google-map-legend-overlay">
            <div className="legend-chip">
              <span className="dot dot-aqua" />
              <span>Active Household ({pins.filter((p) => p.status === 'Normal').length})</span>
            </div>
            <div className="legend-chip">
              <span className="dot dot-orange" />
              <span>Overdue Notice ({pins.filter((p) => p.status === 'Overdue').length})</span>
            </div>
            <div className="legend-chip">
              <span className="dot dot-blue" />
              <span>Maintenance Order ({pins.filter((p) => p.status === 'Maintenance').length})</span>
            </div>
            {gpsStatusText && (
              <div className="legend-chip gps-chip">
                <span><Radio size={11} style={{ display: 'inline', marginRight: '4px' }} /> {gpsStatusText}</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Field Crew Dispatch Modal */}
      {dispatchModal && selectedPin && (
        <div className="modal-backdrop" onClick={() => setDispatchModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDispatchModal(false)}>×</button>
            <div className="modal-title-wrap">
              <p className="eyebrow">FIELD OPERATIONS</p>
              <h2>Dispatch Crew to {selectedPin.name}</h2>
              <p className="modal-copy">
                Create emergency work order and push GPS waypoint to technician terminal.
              </p>
            </div>

            <form onSubmit={handleDispatch}>
              <label>
                Issue / Work Order Reason *
                <select
                  value={dispatchIssue}
                  onChange={(e) => setDispatchIssue(e.target.value)}
                >
                  <option>Immediate Leak Inspection</option>
                  <option>Meter Calibration Check</option>
                  <option>Low Pressure Investigation</option>
                  <option>Disconnection Order Execution</option>
                  <option>Reconnection Service</option>
                </select>
              </label>

              <label>
                Assigned Lead Technician *
                <select
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                >
                  <option>Roberto Ramos (Field Team Alpha)</option>
                  <option>Tomas Cruz (Calibration Specialist)</option>
                  <option>Gil Santos (Plumbing Technician)</option>
                </select>
              </label>

              <div className="notice-box">
                Google Maps GPS Coordinates ({selectedPin.lat?.toFixed(5)}, {selectedPin.lng?.toFixed(5)}) will be sent directly to the technician's mobile handheld terminal.
              </div>

              <button type="submit" className="primary-button full">
                Confirm Dispatch <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* In-App Google GPS Turn-by-Turn Navigation Console Modal */}
      {isInAppNavOpen && activeRouteNav && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 9999, background: 'rgba(16, 32, 51, 0.75)', backdropFilter: 'blur(8px)' }}
          onClick={() => setIsInAppNavOpen(false)}
        >
          <div
            className="modal"
            style={{
              maxWidth: '560px',
              width: '95%',
              padding: 0,
              overflow: 'hidden',
              borderRadius: '24px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(16, 32, 51, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Navigation HUD Header */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0284c7, #102033)',
                color: '#ffffff',
                padding: '20px 22px 18px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      background: '#38bdf8',
                      color: '#102033',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Navigation size={12} /> LIVE GPS NAV
                  </span>
                  <span style={{ fontSize: '12px', opacity: 0.9 }}>Google Turn-by-Turn Assistant</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() =>
                      openInGoogleMaps(
                        activeRouteNav.destLat,
                        activeRouteNav.destLng,
                        activeRouteNav.originLat,
                        activeRouteNav.originLng
                      )
                    }
                    title="Pop out into native Google Maps app"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '5px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <ExternalLink size={12} /> Pop out
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInAppNavOpen(false)}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '50%',
                      width: '28px',
                      height: '28px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Turn Instruction Hero */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '16px',
                    background: '#ffffff',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  }}
                >
                  {navStepIndex === 0 ? (
                    <ArrowUp size={28} strokeWidth={2.5} />
                  ) : navStepIndex === 1 ? (
                    <CornerUpRight size={28} strokeWidth={2.5} />
                  ) : navStepIndex === 2 ? (
                    <ArrowUp size={28} strokeWidth={2.5} />
                  ) : (
                    <Flag size={28} strokeWidth={2.5} color="#0d9488" />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {navStepIndex === 0
                      ? 'In 350 meters'
                      : navStepIndex === 1
                        ? 'In 800 meters'
                        : navStepIndex === 2
                          ? 'In 1.2 kilometers'
                          : 'Arrived at Destination'}
                  </div>
                  <h3 style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 800, lineHeight: 1.2 }}>
                    {navStepIndex === 0
                      ? 'Head north on Mainline Road toward Sector Hub'
                      : navStepIndex === 1
                        ? 'Turn right onto Mabuhay Sector Access Way'
                        : navStepIndex === 2
                          ? 'Continue straight toward premise meter terminal'
                          : `Arrive at ${activeRouteNav.targetName}'s premise`}
                  </h3>
                </div>
              </div>
            </div>

            {/* Embedded Live Google Maps GPS Viewport */}
            <div style={{ position: 'relative', width: '100%', height: '350px', background: '#e2e8f0' }}>
              <iframe
                title="Google Maps Navigation Viewport"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={activeRouteNav.originLat && activeRouteNav.originLng
                  ? `https://maps.google.com/maps?saddr=${activeRouteNav.originLat},${activeRouteNav.originLng}&daddr=${activeRouteNav.destLat},${activeRouteNav.destLng}&t=${navMapMode}&output=embed`
                  : `https://maps.google.com/maps?q=${activeRouteNav.destLat},${activeRouteNav.destLng}&t=${navMapMode}&z=17&output=embed`}
                allowFullScreen
              />

              {/* Turn Navigation Stepper & Map Mode Controls */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: '12px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#102033',
                }}
              >
                <button
                  type="button"
                  onClick={() => setNavMapMode((prev) => (prev === 'k' ? 'm' : 'k'))}
                  style={{
                    background: navMapMode === 'k' ? '#0284c7' : '#e0f2fe',
                    color: navMapMode === 'k' ? '#ffffff' : '#0284c7',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                  title="Toggle Satellite / Roadmap"
                >
                  {navMapMode === 'k' ? '🛰️ Satellite' : '🗺️ Roads'}
                </button>
                <span>Step {navStepIndex + 1} of 4</span>
                <button
                  type="button"
                  disabled={navStepIndex === 0}
                  onClick={() => setNavStepIndex((prev) => Math.max(0, prev - 1))}
                  style={{
                    background: '#e8f0f2',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    cursor: navStepIndex === 0 ? 'not-allowed' : 'pointer',
                    opacity: navStepIndex === 0 ? 0.4 : 1,
                    fontSize: '11px',
                  }}
                >
                  ◀ Prev
                </button>
                <button
                  type="button"
                  disabled={navStepIndex >= 3}
                  onClick={() => setNavStepIndex((prev) => Math.min(3, prev + 1))}
                  style={{
                    background: '#0284c7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    cursor: navStepIndex >= 3 ? 'not-allowed' : 'pointer',
                    opacity: navStepIndex >= 3 ? 0.4 : 1,
                    fontSize: '11px',
                  }}
                >
                  Next ▶
                </button>
              </div>
            </div>

            {/* Bottom Route Summary & Details Panel */}
            <div style={{ padding: '16px 20px', background: '#f8fbfa', borderTop: '1px solid #e8f0f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '18px', color: '#102033' }}>
                      {activeRouteNav.durationMin} mins
                    </strong>
                    <span style={{ fontSize: '13px', color: '#617286' }}>
                      ({activeRouteNav.distanceKm} km)
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#0d9488', fontWeight: 600 }}>
                    Fastest route via Municipal Road network · Light Traffic
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#617286', textTransform: 'uppercase' }}>Destination Premise</span>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#102033' }}>
                    {activeRouteNav.targetName}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsInAppNavOpen(false)}
                  style={{ flex: 1, height: '44px' }}
                >
                  End Navigation
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    flash(`Navigation locked on ${activeRouteNav.targetName}. Technician en route.`)
                    setIsInAppNavOpen(false)
                  }}
                  style={{
                    flex: 1.5,
                    height: '44px',
                    background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle2 size={16} /> Confirm Arrival & Open Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
