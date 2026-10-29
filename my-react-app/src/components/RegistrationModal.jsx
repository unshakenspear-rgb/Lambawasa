import { useEffect, useRef, useState } from 'react'
import L from '../services/leaflet'

const TAMPAKAN_CENTER = [6.443, 124.932]
const TAMPAKAN_BOUNDS = L.latLngBounds([6.30, 124.80], [6.58, 125.08])
const REGISTRATION_DRAFT_KEY = 'lambawasa_registration_draft'
const REGISTRATION_MAP_LAYERS = {
  roadmap: {
    label: 'Roadmap',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: 'Map data &copy; Google Maps',
  },
  satellite: {
    label: 'Satellite Hybrid',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: 'Imagery &copy; Google Maps',
  },
  terrain: {
    label: 'Terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: 'Map data &copy; Google Maps',
  },
}

const registrationPinIcon = L.divIcon({
  className: 'registration-location-marker',
  html: '<span class="registration-location-marker-dot">●</span>',
  iconSize: [34, 42],
  iconAnchor: [17, 42],
  popupAnchor: [0, -38],
})

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

export default function RegistrationModal({ isOpen, onClose, onRegistered, serviceBoundary, clusterBoundaries = [] }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [address, setAddress] = useState('')
  const [serviceCoordinates, setServiceCoordinates] = useState(null)
  const [selectedCluster, setSelectedCluster] = useState('')
  const [isResolvingAddress, setIsResolvingAddress] = useState(false)
  const [classification, setClassification] = useState('Residential')
  const [baseMapType, setBaseMapType] = useState('roadmap')
  const [error, setError] = useState('')

  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const tileLayerRef = useRef(null)
  const addressMarkerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    try {
      const savedDraft = JSON.parse(window.sessionStorage.getItem(REGISTRATION_DRAFT_KEY) || 'null')
      if (!savedDraft) return
      setAddress(savedDraft.address || '')
      setServiceCoordinates(savedDraft.serviceCoordinates || null)
      setSelectedCluster(savedDraft.selectedCluster || '')
      setBaseMapType(savedDraft.baseMapType || 'roadmap')
    } catch {
      window.sessionStorage.removeItem(REGISTRATION_DRAFT_KEY)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    window.sessionStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify({
      address,
      serviceCoordinates,
      selectedCluster,
      baseMapType,
    }))
  }, [isOpen, address, serviceCoordinates, selectedCluster, baseMapType])

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapInstanceRef.current) return

    const boundaryPoints = serviceBoundary?.coordinates || []
    const registrationBounds = boundaryPoints.length >= 3
      ? L.latLngBounds(boundaryPoints)
      : TAMPAKAN_BOUNDS
    const registrationCenter = registrationBounds.getCenter()

    const map = L.map(mapContainerRef.current, {
      center: [registrationCenter.lat, registrationCenter.lng] || TAMPAKAN_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      maxBounds: registrationBounds,
      maxBoundsViscosity: 1,
    })

    const layerConfig = REGISTRATION_MAP_LAYERS[baseMapType]
    const tileLayer = L.tileLayer(layerConfig.url, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: layerConfig.attribution,
    }).addTo(map)
    tileLayerRef.current = tileLayer

    if (boundaryPoints.length >= 3) {
      L.polygon(boundaryPoints, {
        color: '#dc2626',
        weight: 2,
        dashArray: '7 5',
        fillColor: '#ef4444',
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map)
      map.fitBounds(registrationBounds, { padding: [18, 18] })
    }

    clusterBoundaries.forEach((cluster) => {
      const coordinates = cluster.coordinates || []
      if (coordinates.length < 3) return
      L.polygon(coordinates, {
        color: '#2563eb',
        weight: 2,
        dashArray: '5 4',
        fillColor: '#60a5fa',
        fillOpacity: 0.2,
        interactive: false,
      }).bindTooltip(`${cluster.name} cluster`, { sticky: true }).addTo(map)
    })

    map.on('click', async (event) => {
      const { lat, lng } = event.latlng
      const isAllowedLocation = boundaryPoints.length >= 3
        ? isPointInsidePolygon({ lat, lng }, boundaryPoints)
        : TAMPAKAN_BOUNDS.contains([lat, lng])
      if (!isAllowedLocation) {
        setError('Service locations must be inside the President-approved boundary.')
        return
      }

      const cluster = clusterBoundaries.find((item) => (
        Array.isArray(item.coordinates)
        && item.coordinates.length >= 3
        && isPointInsidePolygon({ lat, lng }, item.coordinates)
      ))
      setSelectedCluster(cluster?.name || '')

      setServiceCoordinates({ lat, lng })
      setIsResolvingAddress(true)

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18`,
          { headers: { Accept: 'application/json' } }
        )
        if (!response.ok) throw new Error('Address lookup failed')
        const result = await response.json()
        setAddress(result.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      } catch {
        setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`)
      } finally {
        setIsResolvingAddress(false)
      }
    })

    mapInstanceRef.current = map
    window.setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      addressMarkerRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (addressMarkerRef.current) {
      map.removeLayer(addressMarkerRef.current)
      addressMarkerRef.current = null
    }
    if (!serviceCoordinates) return
    addressMarkerRef.current = L.marker([serviceCoordinates.lat, serviceCoordinates.lng], { icon: registrationPinIcon })
      .bindPopup('Selected service location')
      .addTo(map)
  }, [serviceCoordinates])

  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return
    const layerConfig = REGISTRATION_MAP_LAYERS[baseMapType]
    mapInstanceRef.current.removeLayer(tileLayerRef.current)
    tileLayerRef.current = L.tileLayer(layerConfig.url, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: layerConfig.attribution,
    }).addTo(mapInstanceRef.current)
  }, [baseMapType])

  if (!isOpen) return null

  const resetForm = () => {
    setFullName('')
    setEmail('')
    setMobile('')
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setAddress('')
    setServiceCoordinates(null)
    setSelectedCluster('')
    setIsResolvingAddress(false)
    setClassification('Residential')
    setBaseMapType('roadmap')
    setError('')
    window.sessionStorage.removeItem(REGISTRATION_DRAFT_KEY)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const cleanEmail = email.trim().toLowerCase()

    if (password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please check both fields.')
      return
    }
    if (!serviceCoordinates) {
      setError('Select the household service location on the map.')
      return
    }
    if (!selectedCluster) {
      setError('Select a service cluster by placing the pin inside an approved cluster boundary.')
      return
    }

    try {
      await onRegistered({
        fullName: fullName.trim(),
        email: cleanEmail,
        mobile: mobile.trim(),
        username: username.trim().toLowerCase(),
        password,
        zone: selectedCluster,
        cluster: selectedCluster,
        address: address.trim(),
        serviceCoordinates,
        classification,
        role: 'House Hold',
        createdAt: new Date().toISOString(),
      })
      resetForm()
    } catch (err) {
      setError(err?.message || 'Registration could not be completed. Please try again.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="registration-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose} aria-label="Close registration dialog">×</button>

        <div className="registration-header">
          <div className="registration-icon">✦</div>
          <div>
            <span className="registration-kicker">NEW HOUSEHOLD ACCOUNT</span>
            <h2>Create your Lambawasa account</h2>
            <p>Set up your verified household account with online bill tracking and problem reporting access.</p>
          </div>
        </div>

        {error && <div className="login-error-banner" role="alert">⚠️ {error}</div>}

        <form onSubmit={handleSubmit} className="registration-form">
          <div className="registration-form-grid">
            <label>
              Full name
              <input type="text" required placeholder="e.g. David Morales" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label className="registration-address-field">
              Service Address <span className="map-field-hint">Click the map to place the service pin</span>
              <div className="registration-map-wrapper">
                <div className="registration-map-layers" role="group" aria-label="Map layer">
                  {Object.entries(REGISTRATION_MAP_LAYERS).map(([key, layer]) => (
                    <button
                      key={key}
                      type="button"
                      className={baseMapType === key ? 'active' : ''}
                      onClick={() => setBaseMapType(key)}
                    >
                      {layer.label}
                    </button>
                  ))}
                </div>
                <div ref={mapContainerRef} className="registration-map" />
                {!serviceCoordinates && <div className="registration-map-empty">📍 Select the household location</div>}
              </div>
              <input
                type="text"
                required
                readOnly
                placeholder="Choose a location on the map"
                value={isResolvingAddress ? 'Resolving address...' : address}
                aria-describedby="registration-address-status"
              />
              <small id="registration-address-status" className="registration-address-status">
                {serviceCoordinates
                  ? `${serviceCoordinates.lat.toFixed(5)}, ${serviceCoordinates.lng.toFixed(5)}${selectedCluster ? ` · ${selectedCluster}` : ' · No cluster selected'}`
                  : 'Your selected map location will be used as the service address.'}
              </small>
            </label>
            <label>
              Account Type
              <select value={classification} onChange={(e) => setClassification(e.target.value)}>
                <option value="Residential">Residential (Household)</option>
                <option value="Commercial">Commercial</option>
              </select>
            </label>
            <label>
              Email address
              <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              Mobile number
              <input type="tel" required placeholder="+63 917 000 0000" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </label>
            <label>
              Account username
              <input type="text" required minLength="4" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label>
              Create password
              <input type="password" required minLength="8" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label>
              Confirm password
              <input type="password" required minLength="8" placeholder="Re-enter your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
          </div>

          <label className="registration-consent">
            <input type="checkbox" required />
            <span>I agree to receive Lambawasa billing and service updates.</span>
          </label>

          <button
            type="submit"
            className="primary-button full btn-lg"
          >
            Create household account →
          </button>
        </form>

        <p className="registration-footer">Already registered? Close this window and sign in with your account.</p>
      </div>
    </div>
  )
}
