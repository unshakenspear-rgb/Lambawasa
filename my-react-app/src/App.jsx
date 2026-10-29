import { useState, useEffect } from 'react'
import './App.css'

import {
  initialConsumers,
  initialMeters,
  initialGeoPins,
  initialBills,
  initialPayments,
  initialComplaints,
  initialAuditLogs,
  initialStaff,
  initialNotifications,
  initialAdjustments,
  initialRatings,
  calculateConsumptionBill,
} from './data/mockData'

import OverviewDashboard from './components/OverviewDashboard'
import HouseholdProfiling from './components/HouseholdProfiling'
import MeterAssetLogging from './components/MeterAssetLogging'
import GeographicalMapping from './components/GeographicalMapping'
import AutomatedConsumptionCalculator from './components/AutomatedConsumptionCalculator'
import BatchBillGeneration from './components/BatchBillGeneration'
import ArrearsPenaltyTracker from './components/ArrearsPenaltyTracker'
import PaymentPOS from './components/PaymentPOS'
import MaintenanceComplaintLog from './components/MaintenanceComplaintLog'
import OperationalAuditTrail from './components/OperationalAuditTrail'
import ReportsModule from './components/ReportsModule'
import NotificationsModule from './components/NotificationsModule'
import ConsumerPortal from './components/ConsumerPortal'
import HRModule from './components/HRModule'
import LandingPage from './components/LandingPage'
import ConsumerLandingPage from './components/ConsumerLandingPage'
import StaffLandingPage from './components/StaffLandingPage'
import FieldStaffPortal from './components/FieldStaffPortal'
import FieldStaffNavigation from './components/FieldStaffNavigation'
import LoginModal from './components/LoginModal'
import RegistrationModal from './components/RegistrationModal'
import { api } from './services/api'

const DEFAULT_SERVICE_BOUNDARY = {
  type: 'polygon',
  coordinates: [
    [6.445, 124.950],
    [6.445, 124.990],
    [6.435, 125.005],
    [6.415, 124.995],
    [6.410, 124.965],
    [6.420, 124.945],
  ],
}

const DEFAULT_CURRENT_USER = {
  fullName: 'Jamie Dizon',
  role: 'Administrator',
  username: 'jamie.dizon',
  avatar: 'JD',
}

function loadCurrentUser() {
  const savedUser = loadFromStorage('lambawasa_currentUser', DEFAULT_CURRENT_USER)
  return savedUser && typeof savedUser === 'object' ? savedUser : DEFAULT_CURRENT_USER
}

function isHouseholdRole(role) {
  return ['House Hold', 'Household', 'Consumer', 'Household Consumer'].includes(role)
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

function findClusterForItem(item, clusters) {
  const lat = Number(item?.lat ?? item?.latitude)
  const lng = Number(item?.lng ?? item?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return clusters.find((cluster) => (
    Array.isArray(cluster.coordinates)
    && cluster.coordinates.length >= 3
    && isPointInsidePolygon({ lat, lng }, cluster.coordinates)
  )) || null
}

function withoutNorthbankCluster(clusters) {
  return clusters.filter((cluster) => cluster.name?.trim().toLowerCase() !== 'northbank')
}

function loadClearedNotificationIds() {
  try {
    const raw = localStorage.getItem('lambawasa_clearedNotifIds')
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch { return new Set() }
}

function saveClearedNotificationIds(set) {
  try {
    localStorage.setItem('lambawasa_clearedNotifIds', JSON.stringify([...set]))
  } catch { /* ignore quota */ }
}

function loadServiceBoundary() {
  const resetKey = 'lambawasa_service_boundary_reset_v5'
  if (!window.localStorage.getItem(resetKey)) {
    window.localStorage.removeItem('lambawasa_serviceBoundary')
    window.localStorage.setItem(resetKey, 'complete')
    return DEFAULT_SERVICE_BOUNDARY
  }

  const savedBoundary = loadFromStorage('lambawasa_serviceBoundary', DEFAULT_SERVICE_BOUNDARY)
  return savedBoundary?.type === 'polygon' && Array.isArray(savedBoundary.coordinates)
    ? savedBoundary
    : DEFAULT_SERVICE_BOUNDARY
}

function loadClusterBoundaries() {
  const resetKey = 'lambawasa_cluster_boundary_reset_v1'
  if (!window.localStorage.getItem(resetKey)) {
    window.localStorage.removeItem('lambawasa_clusterBoundaries')
    window.localStorage.setItem(resetKey, 'complete')
    return []
  }
  const savedClusters = loadFromStorage('lambawasa_clusterBoundaries', [])
  if (!Array.isArray(savedClusters)) return []

  return withoutNorthbankCluster(savedClusters).map((cluster, index) => ({
    ...cluster,
    id: cluster.id && cluster.id !== 'draft-cluster'
      ? cluster.id
      : `cluster-${Date.now()}-${index}`,
  }))
}

import {
  LayoutDashboard,
  BarChart3,
  Bell,
  Users,
  Gauge,
  MapPin,
  Calculator,
  ReceiptText,
  AlertTriangle,
  CreditCard,
  LifeBuoy,
  History,
  UserCheck,
  LogOut
} from 'lucide-react'

// All system navigation items tagged with permitted FDD roles
const allNavItems = [
  { id: 'Overview', label: 'Overview', icon: LayoutDashboard, roles: ['President', 'Office Staffs', 'Administrator'] },
  { id: 'Reports', label: 'Reports', icon: BarChart3, badge: 'FDD', roles: ['President', 'Office Staffs', 'Administrator'] },
  { id: 'Notifications', label: 'Notifications', icon: Bell, badge: 'Auto', roles: ['Office Staffs', 'Cashier', 'President', 'Administrator'] },
  { id: 'Household Profiling', label: 'Consumers', icon: Users, roles: ['Office Staffs', 'President', 'Administrator'] },
  { id: 'Meter Assets', label: 'Meter Assets', icon: Gauge, roles: ['Field Staffs', 'Office Staffs', 'President', 'Administrator'] },
  { id: 'Geographical Mapping', label: 'Geo Mapping', icon: MapPin, roles: ['Field Staffs', 'President', 'Administrator'] },
  { id: 'Consumption Calculator', label: 'Cubic Meter Calculator', icon: Calculator, badge: 'Cubic m³', roles: ['President', 'Field Staffs', 'Cashier', 'Administrator'] },
  { id: 'Batch Billing', label: 'Batch Billing', icon: ReceiptText, badge: 'Run', roles: ['Office Staffs', 'Cashier', 'President', 'Administrator'] },
  { id: 'Arrears & Penalties', label: 'Arrears & Penalties', icon: AlertTriangle, badge: 'Alert', roles: ['Office Staffs', 'Cashier', 'President', 'Administrator'] },
  { id: 'Payment P.O.S.', label: 'Payment P.O.S.', icon: CreditCard, roles: ['Cashier', 'President', 'Administrator'] },
  { id: 'Service Desk', label: 'Report Problem', icon: LifeBuoy, roles: ['Field Staffs', 'Office Staffs', 'Administrator'] },
  { id: 'Operational Audit Trail', label: 'Audit Trail', icon: History, roles: ['President', 'Administrator'] },
  { id: 'Staff Management', label: 'Staff Management', icon: UserCheck, roles: ['President', 'Administrator'] },
]


// Safe localStorage loader helper
function loadFromStorage(key, fallback) {
  try {
    const legacyKey = key.replace('lambawasa_', 'water' + 'line_')
    const item = window.localStorage.getItem(key) ?? window.localStorage.getItem(legacyKey)
    if (item !== null && window.localStorage.getItem(key) === null) {
      window.localStorage.setItem(key, item)
    }
    return item !== null ? JSON.parse(item) : fallback
  } catch (err) {
    return fallback
  }
}

function App() {
  const normalizedPath = window.location.pathname
    .replace(/^\/SIA\/my-react-app\/dist/i, '')
    .replace(/^\/SIA\/my-react-app/i, '')
    .replace(/\/+$/, '') || '/'

  const currentPath = normalizedPath
  const isStaffEntryPage = currentPath === '/staff'
    || currentPath === 'staff'
    || import.meta.env.MODE === 'staff'

  // Public Landing Page & Persistent Authentication State
  // Use sessionStorage for auth — so each browser tab starts with a fresh login.
  // This prevents one user's session bleeding into another user's tab on a shared device.
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('lambawasa_isLoggedIn') || 'false') } catch { return false }
  })
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginModalMode, setLoginModalMode] = useState('consumer')
  const [showRegistrationModal, setShowRegistrationModal] = useState(false)
  const [registeredUsers, setRegisteredUsers] = useState(() => loadFromStorage('lambawasa_registeredUsers', []))
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('lambawasa_currentUser') || 'null')
      return saved && typeof saved === 'object' ? saved : DEFAULT_CURRENT_USER
    } catch { return DEFAULT_CURRENT_USER }
  })

  // Persistent Global Application & Active Navigation State
  const [activeNav, setActiveNav] = useState(() => loadFromStorage('lambawasa_activeNav', 'Overview'))
  const [consumers, setConsumers] = useState(() => loadFromStorage('lambawasa_consumers', initialConsumers))
  const [meters, setMeters] = useState(() => loadFromStorage('lambawasa_meters', initialMeters))
  const [geoPins, setGeoPins] = useState(() => loadFromStorage('lambawasa_geoPins', initialGeoPins))
  const [serviceBoundary, setServiceBoundary] = useState(loadServiceBoundary)
  const [clusterBoundaries, setClusterBoundaries] = useState(loadClusterBoundaries)
  const [bills, setBills] = useState(() => loadFromStorage('lambawasa_bills', initialBills))
  const [payments, setPayments] = useState(() => loadFromStorage('lambawasa_payments', initialPayments))
  const [complaints, setComplaints] = useState(() => loadFromStorage('lambawasa_complaints', initialComplaints))
  const [auditLogs, setAuditLogs] = useState(() => loadFromStorage('lambawasa_auditLogs', initialAuditLogs))
  const [staff, setStaff] = useState(() => loadFromStorage('lambawasa_staff', initialStaff))
  const [notifications, setNotifications] = useState(() => {
    const cleared = loadClearedNotificationIds()
    return loadFromStorage('lambawasa_notifications', initialNotifications).filter((n) => !cleared.has(n.id))
  })
  const [adjustments, setAdjustments] = useState(() => loadFromStorage('lambawasa_adjustments', initialAdjustments))
  const [ratings, setRatings] = useState(() => loadFromStorage('lambawasa_ratings', initialRatings))
  const [pendingMeterReadings, setPendingMeterReadings] = useState([])
  const [fieldTrackedTicketId, setFieldTrackedTicketId] = useState(null)

  // Browser storage is the offline fallback when the PHP/MySQL service is unavailable.
  // Auth state uses sessionStorage — clears on tab close, preventing session bleed between users.
  useEffect(() => {
    sessionStorage.setItem('lambawasa_isLoggedIn', JSON.stringify(isLoggedIn))
    // Also clear from localStorage so old sessions don't linger
    localStorage.removeItem('lambawasa_isLoggedIn')
  }, [isLoggedIn])

  useEffect(() => {
    localStorage.setItem('lambawasa_activeNav', JSON.stringify(activeNav))
  }, [activeNav])

  useEffect(() => {
    sessionStorage.setItem('lambawasa_currentUser', JSON.stringify(currentUser))
    localStorage.removeItem('lambawasa_currentUser')
  }, [currentUser])

  useEffect(() => {
    localStorage.setItem('lambawasa_serviceBoundary', JSON.stringify(serviceBoundary))
  }, [serviceBoundary])

  useEffect(() => {
    localStorage.setItem('lambawasa_clusterBoundaries', JSON.stringify(clusterBoundaries))
  }, [clusterBoundaries])

  useEffect(() => {
    localStorage.setItem('lambawasa_consumers', JSON.stringify(consumers))
  }, [consumers])

  useEffect(() => {
    localStorage.setItem('lambawasa_meters', JSON.stringify(meters))
  }, [meters])

  useEffect(() => {
    localStorage.setItem('lambawasa_geoPins', JSON.stringify(geoPins))
  }, [geoPins])

  useEffect(() => {
    localStorage.setItem('lambawasa_bills', JSON.stringify(bills))
  }, [bills])

  useEffect(() => {
    localStorage.setItem('lambawasa_payments', JSON.stringify(payments))
  }, [payments])

  useEffect(() => {
    localStorage.setItem('lambawasa_complaints', JSON.stringify(complaints))
  }, [complaints])

  useEffect(() => {
    localStorage.setItem('lambawasa_auditLogs', JSON.stringify(auditLogs))
  }, [auditLogs])

  useEffect(() => {
    localStorage.setItem('lambawasa_staff', JSON.stringify(staff))
  }, [staff])

  useEffect(() => {
    localStorage.setItem('lambawasa_notifications', JSON.stringify(notifications))
  }, [notifications])

  useEffect(() => {
    if (!clusterBoundaries.length) return

    const nextPins = geoPins.map((pin) => {
      const cluster = findClusterForItem(pin, clusterBoundaries)
      return cluster && (pin.cluster !== cluster.name || pin.zone !== cluster.name)
        ? { ...pin, cluster: cluster.name, zone: cluster.name }
        : pin
    })
    const nextConsumers = consumers.map((consumer) => {
      const pin = nextPins.find((item) => item.consumerId === consumer.id)
      const cluster = findClusterForItem(pin || consumer, clusterBoundaries)
      return cluster && (consumer.cluster !== cluster.name || consumer.zone !== cluster.name)
        ? { ...consumer, cluster: cluster.name, zone: cluster.name }
        : consumer
    })

    if (nextPins.some((pin, index) => pin !== geoPins[index])) setGeoPins(nextPins)
    if (nextConsumers.some((consumer, index) => consumer !== consumers[index])) setConsumers(nextConsumers)
  }, [clusterBoundaries, geoPins, consumers])

  // Automatically create one overdue notice per bill for the current billing cycle.
  useEffect(() => {
    const monthKey = new Date().toISOString().slice(0, 7)
    const overdueBills = bills.filter((bill) => bill.status === 'Overdue')
    const pendingNotices = overdueBills
      .filter((bill) => {
        const noticeId = `NTF-OVERDUE-${bill.id}-${monthKey}`
        return !notifications.some((notice) => notice.id === noticeId)
      })
      .map((bill) => ({
        id: `NTF-OVERDUE-${bill.id}-${monthKey}`,
        type: 'Overdue Notice',
        recipient: bill.name,
        accountNo: bill.accountNo,
        message: `Monthly overdue notice for ${bill.id}: ₱${Number(bill.totalAmount).toFixed(2)} remains unpaid and is ${bill.daysOverdue || 0} days overdue. Please settle to avoid service interruption.`,
        sentAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        status: 'Sent',
        channel: 'System Push',
      }))

    if (pendingNotices.length > 0) {
      setNotifications((previous) => [...pendingNotices, ...previous])
      pendingNotices.forEach((notice) => {
        api.createNotification(notice).catch((error) => console.warn('DB overdue notification failed', error))
      })
    }
  }, [bills, notifications])

  useEffect(() => {
    localStorage.setItem('lambawasa_adjustments', JSON.stringify(adjustments))
  }, [adjustments])

  useEffect(() => {
    localStorage.setItem('lambawasa_ratings', JSON.stringify(ratings))
  }, [ratings])

  useEffect(() => {
    localStorage.setItem('lambawasa_registeredUsers', JSON.stringify(registeredUsers))
  }, [registeredUsers])

  // Automated System Rule: Every unpaid account that passes the 25th of the month is flagged as Overdue with 10% penalty
  useEffect(() => {
    let needsUpdate = false
    const updatedBills = bills.map((bill) => {
      if (bill.status === 'Paid') return bill

      // Check if due date is beyond the 25th of the month
      let isPast25th = false
      let daysPast = 0
      if (bill.dueDate) {
        const parts = bill.dueDate.split('-')
        const day = parts.length === 3 ? parseInt(parts[2], 10) : 20
        if (day > 25) {
          isPast25th = true
          daysPast = day - 25
        }
      }

      // Check if bill needs to be flagged as Overdue or needs automatic 10% penalty
      const shouldBeOverdue = isPast25th || bill.status === 'Overdue' || (bill.daysOverdue || 0) > 0
      const statutoryPenalty = +((Number(bill.baseAmount || 0) + Number(bill.arrears || 0)) * 0.1).toFixed(2)
      const expectedPenalty = shouldBeOverdue ? Math.max(statutoryPenalty, Number(bill.penalty || 0)) : Number(bill.penalty || 0)

      if (
        (shouldBeOverdue && bill.status !== 'Overdue') ||
        (shouldBeOverdue && Number(bill.penalty || 0) === 0)
      ) {
        needsUpdate = true
        return {
          ...bill,
          status: 'Overdue',
          daysOverdue: Math.max(bill.daysOverdue || 0, daysPast, 1),
          penalty: expectedPenalty,
          totalAmount: +(Number(bill.baseAmount || 0) + Number(bill.arrears || 0) + expectedPenalty + Number(bill.envFee || 0) + Number(bill.maintFee || 0)).toFixed(2),
        }
      }
      return bill
    })

    if (needsUpdate) {
      setBills(updatedBills)
    }
  }, [bills])


  // Live MySQL Database State & Synchronization
  const [dbStatus, setDbStatus] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const syncFromDatabase = async (silent = false) => {
    setIsSyncing(true)
    try {
      const scheduledBilling = await api.runScheduledBilling()
      if (!scheduledBilling.success) {
        console.warn('Scheduled billing check failed:', scheduledBilling.error)
      }
      const status = await api.checkDbStatus()
      setDbStatus(status)
      if (status && status.connected) {
        const sysData = await api.fetchSystemData()
        if (sysData) {
          if (Array.isArray(sysData.consumers)) setConsumers(sysData.consumers)
          if (Array.isArray(sysData.meters)) setMeters(sysData.meters)
          if (Array.isArray(sysData.geoPins)) setGeoPins(sysData.geoPins)
          if (Array.isArray(sysData.bills)) setBills(sysData.bills)
          if (Array.isArray(sysData.meterReadings)) {
            setPendingMeterReadings(sysData.meterReadings.filter(
              (reading) => reading.status === 'Pending Office Confirmation'
            ))
          }
          if (Array.isArray(sysData.payments)) setPayments(sysData.payments)
          if (Array.isArray(sysData.complaints)) {
            // Merge: prefer DB resolutionImage, fall back to in-memory state image,
            // then fall back to the dedicated localStorage image store
            const imageStore = (() => { try { return JSON.parse(localStorage.getItem('lambawasa_resolutionImages') || '{}') } catch { return {} } })()
            setComplaints((prev) =>
              sysData.complaints.map((dbC) => {
                const memC = prev.find((c) => c.id === dbC.id)
                const image = dbC.resolutionImage || memC?.resolutionImage || imageStore[dbC.id] || null
                return image ? { ...dbC, resolutionImage: image } : dbC
              })
            )
          }
          if (Array.isArray(sysData.auditLogs)) setAuditLogs(sysData.auditLogs)
          if (Array.isArray(sysData.staff)) setStaff(sysData.staff)
          if (Array.isArray(sysData.notifications)) {
            const cleared = loadClearedNotificationIds()
            const imageStore = (() => { try { return JSON.parse(localStorage.getItem('lambawasa_resolutionImages') || '{}') } catch { return {} } })()
            setNotifications((prev) =>
              sysData.notifications
                .filter((n) => !cleared.has(n.id))
                .map((dbN) => {
                  const memN = prev.find((n) => n.id === dbN.id)
                  // DB image > in-memory > localStorage image store keyed by ticketId
                  const image = dbN.resolutionImage || memN?.resolutionImage || (dbN.ticketId ? imageStore[dbN.ticketId] : null) || null
                  return image ? { ...dbN, resolutionImage: image } : dbN
                })
            )
          }
          if (sysData.serviceBoundary?.type === 'polygon') setServiceBoundary(sysData.serviceBoundary)
          if (Array.isArray(sysData.clusterBoundaries)) setClusterBoundaries(withoutNorthbankCluster(sysData.clusterBoundaries))
          if (!silent) flash('Synchronized live data from MySQL (waterline_db)')
        }
      } else {
        setServiceBoundary(loadServiceBoundary())
        setClusterBoundaries(loadClusterBoundaries())
      }
    } catch (err) {
      console.warn('Sync from MySQL database failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }

  // Load from MySQL on mount and periodically check DB health
  useEffect(() => {
    syncFromDatabase(true)
    const interval = setInterval(() => syncFromDatabase(true), 25000)
    return () => clearInterval(interval)
  }, [])

  // Navigation helpers & inter-module linking
  const [posPrefillAccount, setPosPrefillAccount] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const [globalNavSearch, setGlobalNavSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const confirmSignOut = () => setShowSignOutConfirm(true)
  const doSignOut = (msg = 'Successfully signed out.') => {
    setShowSignOutConfirm(false)
    setIsLoggedIn(false)
    flash(msg)
  }

  const flash = (message) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3000)
  }

  // Audit Logger Helper (Persists to State and MySQL audit_trail)
  const recordAudit = (category, action, target, details) => {
    const newLog = {
      id: `AUD-${906 + auditLogs.length}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: currentUser.fullName,
      role: currentUser.role,
      category,
      action,
      target,
      details,
      ip: '192.168.1.104',
    }
    setAuditLogs((prev) => [newLog, ...prev])
    api.recordAudit(newLog).catch((e) => console.warn('DB audit failed', e))
  }

  // Action: Add Consumer (Household Profiling & MySQL Persistence)
  const handleAddConsumer = (newConsumer) => {
    setConsumers((prev) => [newConsumer, ...prev])

    // Call MySQL API in background
    api.addConsumer(newConsumer).then((res) => {
      if (res?.success) {
        api.checkDbStatus().then((st) => setDbStatus(st))
      }
    }).catch((err) => console.warn('DB consumer insert failed', err))

    // Add associated meter
    const newMeter = {
      serialNo: newConsumer.meterNo,
      brand: 'Aquaflow Pro',
      model: 'AF-20-Brass',
      size: '1/2 inch',
      installDate: newConsumer.connectionDate,
      consumerId: newConsumer.id,
      consumerName: newConsumer.name,
      zone: newConsumer.zone,
      lastCalibration: newConsumer.connectionDate,
      nextCalibration: '2028-09-01',
      status: 'Active',
      history: [
        {
          date: newConsumer.connectionDate,
          type: 'Initial Connection',
          technician: 'Jamie Dizon',
          notes: 'New household meter line connected.',
        },
      ],
    }
    setMeters((prev) => [newMeter, ...prev])

    // Add map pin
    const randomX = Math.floor(Math.random() * 60) + 20
    const randomY = Math.floor(Math.random() * 60) + 20
    setGeoPins((prev) => [
      ...prev,
      {
        id: `GP-${prev.length + 1}`,
        consumerId: newConsumer.id,
        name: newConsumer.name,
        zone: newConsumer.zone,
        x: randomX,
        y: randomY,
        status: 'Normal',
        meterNo: newConsumer.meterNo,
        reading: 0,
      },
    ])

    recordAudit(
      'Consumer',
      'Registered Consumer Profile',
      `${newConsumer.name} (${newConsumer.accountNo})`,
      `Created profile in ${newConsumer.zone} with assigned meter ${newConsumer.meterNo}.`
    )
  }

  const handleUpdateConsumerApproval = (consumerId, decision) => {
    const nextStatus = decision === 'Approved' ? 'Active' : 'Rejected'
    setConsumers((prev) => prev.map((consumer) => (
      consumer.id === consumerId
        ? { ...consumer, status: nextStatus, approvalStatus: decision }
        : consumer
    )))
    setRegisteredUsers((prev) => prev.map((user) => (
      user.consumerId === consumerId
        ? { ...user, status: nextStatus, approvalStatus: decision }
        : user
    )))
    setMeters((prev) => prev.map((meter) => (
      meter.consumerId === consumerId
        ? { ...meter, status: nextStatus, approvalStatus: decision }
        : meter
    )))
    setGeoPins((prev) => prev.map((pin) => (
      pin.consumerId === consumerId
        ? { ...pin, status: decision === 'Approved' ? 'Normal' : 'Rejected' }
        : pin
    )))
    api.updateConsumerApproval(consumerId, decision).catch((error) => {
      console.warn('DB consumer approval update failed', error)
    })

    const reviewedConsumer = consumers.find((consumer) => consumer.id === consumerId)
    if (reviewedConsumer) {
      recordAudit(
        'Consumer',
        `${decision} New Household Account`,
        `${reviewedConsumer.name} (${reviewedConsumer.accountNo})`,
        `President review completed for the ${reviewedConsumer.zone} household registration.`
      )
      flash(`${reviewedConsumer.name}'s account was ${decision.toLowerCase()}.`)
    }
  }

  const handleRequestConsumerLocationChange = (consumerId, coordinates) => {
    setConsumers((prev) => prev.map((consumer) => (
      consumer.id === consumerId
        ? {
          ...consumer,
          locationApprovalStatus: 'Pending',
          requestedLatitude: coordinates.lat,
          requestedLongitude: coordinates.lng,
        }
        : consumer
    )))
    api.requestConsumerLocationChange(consumerId, coordinates.lat, coordinates.lng)
      .catch((error) => console.warn('DB location request failed', error))
    const consumer = consumers.find((item) => item.id === consumerId)
    if (consumer) {
      recordAudit(
        'Consumer',
        'Requested Consumer Location Change',
        `${consumer.name} (${consumer.accountNo})`,
        `Proposed service coordinates: ${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}. Awaiting President approval.`
      )
      flash('Location change submitted for President approval.')
    }
  }

  const handleDecideConsumerLocationChange = (consumerId, decision) => {
    const consumer = consumers.find((item) => item.id === consumerId)
    if (!consumer) return

    const nextCoordinates = decision === 'Approved'
      ? { lat: consumer.requestedLatitude, lng: consumer.requestedLongitude }
      : null
    setConsumers((prev) => prev.map((item) => (
      item.id === consumerId
        ? {
          ...item,
          locationApprovalStatus: decision,
          ...(nextCoordinates ? { latitude: nextCoordinates.lat, longitude: nextCoordinates.lng } : {}),
          requestedLatitude: null,
          requestedLongitude: null,
        }
        : item
    )))
    if (nextCoordinates?.lat && nextCoordinates?.lng) {
      setGeoPins((prev) => prev.map((pin) => (
        pin.consumerId === consumerId ? { ...pin, lat: nextCoordinates.lat, lng: nextCoordinates.lng } : pin
      )))
    }
    api.decideConsumerLocationChange(consumerId, decision)
      .catch((error) => console.warn('DB location decision failed', error))
    recordAudit(
      'Consumer',
      `${decision} Consumer Location Change`,
      `${consumer.name} (${consumer.accountNo})`,
      `President reviewed the proposed service location change.`
    )
    flash(`Location change ${decision.toLowerCase()}.`)
  }

  const handleRecordMeterReading = async ({ meter, consumer, currentReading }) => {
    const target = consumers.find((item) => item.id === consumer?.id || item.accountNo === consumer?.accountNo)
    if (!target) {
      flash('This meter is not assigned to a consumer account.')
      return
    }

    const officialPreviousReading = Number(target.lastReading || 0)
    const current = Number(currentReading)
    if (!Number.isFinite(current) || current < officialPreviousReading) {
      flash(`Present reading must be at least the last approved reading of ${officialPreviousReading} m³.`)
      return
    }
    if (pendingMeterReadings.some((item) => item.consumerId === target.id)) {
      flash(`${target.name} already has a reading waiting for Office Staff approval.`)
      return
    }

    const pendingReading = {
      id: `READ-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      meterSerial: meter?.serialNo || target.meterNo || 'Unassigned',
      consumerId: target.id,
      consumerName: target.name,
      accountNo: target.accountNo,
      zone: target.zone,
      classification: target.classification || 'Residential',
      previousReading: officialPreviousReading,
      currentReading: current,
      recordedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      status: 'Pending Office Confirmation',
    }
    const result = await api.submitMeterReading({
      ...pendingReading,
      actorName: currentUser?.fullName || '',
      actorRole: currentUser?.role || '',
    })
    if (!result.success || !result.data) {
      flash(`Could not save this reading to the shared database. ${result.error || 'Try again after the database connection is restored.'}`)
      return false
    }
    setPendingMeterReadings((prev) => [
      result.data,
      ...prev.filter((item) => item.id !== result.data.id),
    ])
    recordAudit(
      'Meter',
      'Submitted Meter Consumption for Office Confirmation',
      `${pendingReading.meterSerial} (${target.name})`,
      `Reading submitted from ${officialPreviousReading} m³ to ${current} m³. Awaiting Office Staff confirmation.`
    )
    flash('Reading saved to the shared database and submitted for Office Staff approval.')
    return true
  }

  const handlePresidentCorrectReading = async ({ consumer, previousReading, currentReading }) => {
    if (currentUser?.role !== 'President') {
      flash('Only the President can directly correct an official meter reading.')
      return false
    }

    const target = consumers.find((item) => item.id === consumer?.id || item.accountNo === consumer?.accountNo)
    if (!target) {
      flash('This consumer account could not be found.')
      return false
    }
    if (
      !Number.isFinite(previousReading) ||
      !Number.isFinite(currentReading) ||
      previousReading < 0 ||
      currentReading < previousReading
    ) {
      flash('Enter valid meter readings. The present reading must be at least the corrected previous reading.')
      return false
    }

    const result = await api.correctMeterReading({
      consumerId: target.id,
      previousReading,
      currentReading,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
    })
    if (!result?.success || !result.bill) {
      flash(`Could not save the corrected meter reading. ${result?.error || 'Try again after refreshing the account data.'}`)
      return false
    }

    const bill = result.bill
    setConsumers((previous) => previous.map((item) => (
      item.id === target.id ? { ...item, lastReading: currentReading } : item
    )))
    setBills((previous) => [bill, ...previous.filter((item) => item.id !== bill.id)])
    setMeters((previous) => previous.map((meter) => (
      meter.serialNo === (target.meterNo || 'Unassigned')
        ? { ...meter, lastReading: currentReading, readingDate: new Date().toISOString().split('T')[0] }
        : meter
    )))
    setAuditLogs((previous) => [{
      id: `AUD-CORR-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: currentUser.fullName,
      role: currentUser.role,
      category: 'Meter',
      action: 'President Corrected Meter Reading and Generated Bill',
      target: `${target.meterNo || 'Unassigned'} (${target.name})`,
      details: `Corrected previous reading to ${previousReading} m³ and recorded ${currentReading} m³. Consumption: ${bill.consumption} m³. Generated bill ${bill.id} for ₱${Number(bill.totalAmount).toFixed(2)}.`,
      ip: '',
    }, ...previous])
    flash(`Correction saved. ${bill.consumption} m³ was billed at ₱${Number(bill.baseAmount).toFixed(2)} for water usage.`)
    return true
  }

  const handleConfirmMeterReading = async (pendingReading, confirmedBill) => {
    if (currentUser?.role !== 'Office Staffs') {
      flash('Only Office Staff can approve meter readings.')
      return false
    }
    const currentPendingReading = pendingMeterReadings.find((item) => item.id === pendingReading.id)
    if (!currentPendingReading || currentPendingReading.status !== 'Pending Office Confirmation') {
      flash('This meter reading is no longer awaiting approval.')
      return false
    }
    const bill = confirmedBill || calculateConsumptionBill(
      pendingReading.previousReading,
      pendingReading.currentReading
    )
    const penalty = bill.penalty || 0
    const totalAmount = bill.totalAmount
    const billData = {
      id: `WS-${240982 + bills.length}`,
      consumerId: pendingReading.consumerId,
      name: pendingReading.consumerName,
      accountNo: pendingReading.accountNo,
      zone: pendingReading.zone,
      period: 'Sep 01 – Sep 30, 2026',
      prevReading: pendingReading.previousReading,
      presReading: pendingReading.currentReading,
      consumption: bill.consumption,
      baseAmount: bill.baseAmount,
      envFee: bill.envFee,
      maintFee: bill.maintFee,
      arrears: 0,
      penalty,
      totalAmount,
      dueDate: '2026-10-15',
    }
    const result = await api.decideMeterReading(
      pendingReading.id,
      'Approved',
      currentUser.fullName,
      currentUser.role,
      billData
    )
    if (!result.success) {
      flash(`Could not approve this reading in the shared database. ${result.error || 'Refresh and try again.'}`)
      return false
    }
    const savedBillData = { ...billData, ...(result.bill || {}) }
    const queued = handleQueueBill(savedBillData, pendingReading.id)
    if (!queued) return false
    setMeters((prev) => prev.map((meter) => (
      meter.serialNo === pendingReading.meterSerial
        ? { ...meter, lastReading: pendingReading.currentReading, readingDate: new Date().toISOString().split('T')[0] }
        : meter
    )))
    setPendingMeterReadings((prev) => prev.filter((item) => item.id !== pendingReading.id))
    recordAudit(
      'Meter',
      'Confirmed Consumer Meter Consumption',
      `${pendingReading.meterSerial} (${pendingReading.consumerName})`,
      `Confirmed ${pendingReading.previousReading} m³ → ${pendingReading.currentReading} m³. Statement: ₱ ${savedBillData.totalAmount.toFixed(2)}${savedBillData.penalty ? ` including ₱ ${savedBillData.penalty.toFixed(2)} penalty.` : '.'}`
    )
    flash(`Reading confirmed. Current statement: ₱ ${savedBillData.totalAmount.toFixed(2)}.`)
    return true
  }

  const handleRejectMeterReading = async (pendingReading) => {
    if (currentUser?.role !== 'Office Staffs') {
      flash('Only Office Staff can reject meter readings.')
      return
    }
    if (!pendingMeterReadings.some((item) => item.id === pendingReading.id)) return
    const result = await api.decideMeterReading(
      pendingReading.id,
      'Rejected',
      currentUser.fullName,
      currentUser.role
    )
    if (!result.success) {
      flash(`Could not reject this reading in the shared database. ${result.error || 'Refresh and try again.'}`)
      return
    }
    setPendingMeterReadings((prev) => prev.filter((item) => item.id !== pendingReading.id))
    recordAudit(
      'Meter',
      'Rejected Consumer Meter Consumption',
      `${pendingReading.meterSerial} (${pendingReading.consumerName})`,
      `Rejected submitted reading of ${pendingReading.currentReading} m³. The official consumer reading was not changed.`
    )
    flash(`Reading for ${pendingReading.consumerName} was rejected. The official meter reading remains unchanged.`)
  }

  // Action: Update Meter Asset
  const handleUpdateMeter = (updatedMeter) => {
    setMeters((prev) =>
      prev.map((m) => (m.serialNo === updatedMeter.serialNo ? updatedMeter : m))
    )
    api.updateMeter(updatedMeter).catch((e) => console.warn('DB meter update failed', e))
    if (updatedMeter.status === 'Disconnected' && updatedMeter.consumerId) {
      const consumer = consumers.find((item) => item.id === updatedMeter.consumerId)
      setConsumers((prev) => prev.map((item) => (
        item.id === updatedMeter.consumerId ? { ...item, status: 'Disconnected' } : item
      )))
      setGeoPins((prev) => prev.map((pin) => (
        pin.consumerId === updatedMeter.consumerId ? { ...pin, status: 'Maintenance' } : pin
      )))
      if (consumer) {
        const notification = {
          id: `NTF-DISCONNECT-${updatedMeter.serialNo}-${Date.now()}`,
          type: 'Service Alert',
          recipient: consumer.name,
          accountNo: consumer.accountNo,
          consumerId: consumer.id,
          message: `Your water supply has been disconnected because your account is more than 3 days overdue. Please settle the outstanding balance to request reconnection.`,
          sentAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
          status: 'Sent',
          channel: 'System Push',
        }
        setNotifications((prev) => [notification, ...prev])
        api.createNotification(notification).catch((error) => console.warn('DB disconnection notification failed', error))
        flash(`${consumer.name}'s water supply was disconnected and a notification was sent.`)
      }
    }
    recordAudit(
      'Meter',
      'Logged Meter Service/Calibration',
      updatedMeter.serialNo,
      `Status: ${updatedMeter.status}. Calibrated on ${updatedMeter.lastCalibration}.`
    )
  }

  // Action: Add Meter Asset
  const handleAddMeter = (newMeter) => {
    setMeters((prev) => [newMeter, ...prev])
    api.addMeter(newMeter).catch((e) => console.warn('DB meter intake failed', e))
    recordAudit(
      'Meter',
      'Intake New Meter Asset',
      newMeter.serialNo,
      `Registered ${newMeter.brand} (${newMeter.size}) in warehouse inventory.`
    )
  }

  // Action: Delete Meter Asset (President / Admin only)
  const handleDeleteMeter = async (meter) => {
    if (currentUser.role !== 'President' && currentUser.role !== 'Administrator') {
      flash('Only the President can remove meter assets.')
      return
    }

    const serial = meter.serialNo || meter
    const result = await api.deleteMeter(serial, currentUser.role)
    if (!result?.success) {
      flash(result?.error || 'Could not remove the meter asset.')
      return
    }

    setMeters((prev) => prev.filter((m) => m.serialNo !== serial))
    recordAudit(
      'Meter',
      'Removed Meter Asset',
      serial,
      `Permanently removed meter ${meter.brand || ''} (${serial}) from registry.`
    )
    flash(`Meter asset ${serial} was removed successfully.`)
  }

  const handleUpdateClusterBoundaries = (nextClusters) => {
    const savedClusters = withoutNorthbankCluster(nextClusters).map((cluster, index) => ({
      ...cluster,
      id: cluster.id && cluster.id !== 'draft-cluster'
        ? cluster.id
        : `cluster-${Date.now()}-${index}`,
    }))

    setClusterBoundaries(savedClusters)
    api.saveBoundaries(serviceBoundary, savedClusters).then((result) => {
      if (!result?.success) {
        flash(result?.error || 'Could not save cluster boundaries to the central database.')
        return
      }
      flash('Cluster boundaries saved for all users.')
    })

    const findCluster = (item) => {
      const lat = Number(item.lat ?? item.latitude)
      const lng = Number(item.lng ?? item.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return savedClusters.find((cluster) => (
        Array.isArray(cluster.coordinates)
        && cluster.coordinates.length >= 3
        && isPointInsidePolygon({ lat, lng }, cluster.coordinates)
      )) || null
    }

    const updatedPins = geoPins.map((pin) => {
      const cluster = findCluster(pin)
      return cluster ? { ...pin, cluster: cluster.name, zone: cluster.name } : pin
    })
    const updatedConsumers = consumers.map((consumer) => {
      const pin = updatedPins.find((item) => item.consumerId === consumer.id)
      const cluster = findCluster(pin || {
        ...consumer,
        lat: consumer.latitude ?? consumer.requestedLatitude,
        lng: consumer.longitude ?? consumer.requestedLongitude,
      })
      return cluster ? { ...consumer, cluster: cluster.name, zone: cluster.name } : consumer
    })

    setGeoPins(updatedPins)
    setConsumers(updatedConsumers)
    setMeters((previous) => previous.map((meter) => {
      const consumer = updatedConsumers.find((item) => item.id === meter.consumerId)
      return consumer ? { ...meter, zone: consumer.zone } : meter
    }))
    setRegisteredUsers((previous) => previous.map((user) => {
      const consumer = updatedConsumers.find((item) => item.id === user.consumerId)
      return consumer ? { ...user, zone: consumer.zone } : user
    }))
  }

  const handleDeleteConsumer = async (consumer) => {
    if (currentUser.role !== 'President') {
      flash('Only the President can remove consumer accounts.')
      return
    }

    const result = await api.deleteConsumer(consumer.id, currentUser.role)
    if (!result?.success) {
      flash(result?.error || 'Could not remove the consumer account.')
      return
    }

    setConsumers((previous) => previous.filter((item) => item.id !== consumer.id && item.consumerCode !== consumer.id))
    setGeoPins((previous) => previous.filter((pin) => pin.consumerId !== consumer.id))
    setBills((previous) => previous.filter((bill) => bill.consumerId !== consumer.id))
    setPayments((previous) => previous.filter((payment) => payment.consumerId !== consumer.id))
    setNotifications((previous) => previous.filter((notice) => notice.consumerId !== consumer.id && notice.accountNo !== consumer.accountNo))
    flash(`${consumer.name}'s consumer account was removed.`)
  }

  const handleTrackTicket = (ticket) => {
    setFieldTrackedTicketId(ticket.id)
    setActiveNav('Geographical Mapping')
  }

  const handleUpdateServiceBoundary = (nextBoundary) => {
    setServiceBoundary(nextBoundary)
    api.saveBoundaries(nextBoundary, clusterBoundaries).then((result) => {
      if (!result?.success) {
        flash(result?.error || 'Could not save the service boundary to the central database.')
        return
      }
      flash('Main service boundary saved for all users.')
    })
  }

  // Action: Queue Bill from Calculator
  const handleQueueBill = (billData, approvedReadingId) => {
    const approvedReading = pendingMeterReadings.find((reading) => reading.id === approvedReadingId)
    if (
      currentUser?.role !== 'Office Staffs'
      || !approvedReading
      || approvedReading.status !== 'Pending Office Confirmation'
      || approvedReading.consumerId !== billData.consumerId
      || Number(approvedReading.currentReading) !== Number(billData.presReading)
    ) {
      flash('A bill can only be created from a meter reading approved by Office Staff.')
      return false
    }

    const newBillId = billData.id || `WS-${240982 + bills.length}`
    const newBill = {
      id: newBillId,
      consumerId: billData.consumerId,
      name: billData.name,
      accountNo: billData.accountNo,
      zone: billData.zone,
      period: 'Sep 01 – Sep 30, 2026',
      prevReading: billData.prevReading,
      presReading: billData.presReading,
      consumption: billData.consumption,
      baseAmount: billData.baseAmount,
      envFee: billData.envFee,
      maintFee: billData.maintFee,
      arrears: billData.arrears || 0.0,
      penalty: billData.penalty || 0.0,
      totalAmount: billData.totalAmount,
      status: 'Ready',
      dueDate: '2026-10-15',
      avatar: billData.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join(''),
      daysOverdue: 0,
    }
    setBills((prev) => [newBill, ...prev])
    // Align consumer last reading with field staff verified meter reading
    setConsumers((prev) =>
      prev.map((c) =>
        c.id === billData.consumerId || c.accountNo === billData.accountNo
          ? { ...c, lastReading: billData.presReading }
          : c
      )
    )
    recordAudit(
      'Billing',
      'Calculated & Queued Bill Statement',
      `${newBillId} (${billData.name})`,
      `Computed usage of ${billData.consumption} m³. Total payable: ₱ ${billData.totalAmount.toFixed(2)}.`
    )
    return true
  }

  // Action: Execute Batch Bill Generation
  const handleGenerateBatch = (cycle, targetZone) => {
    const targetConsumers =
      targetZone === 'All'
        ? consumers
        : consumers.filter((c) => (c.cluster || c.zone) === targetZone)

    const generated = targetConsumers.slice(0, 4).map((c, index) => {
      const prev = c.lastReading || 50
      const pres = prev + Math.floor(Math.random() * 20) + 10
      const cuM = pres - prev
      const base = cuM <= 10 ? 180 : 180 + (cuM - 10) * 22.5
      const env = +(base * 0.1).toFixed(2)
      const maint = 25.0
      const tot = +(base + env + maint).toFixed(2)

      return {
        id: `WS-B${240990 + bills.length + index}`,
        consumerId: c.id,
        name: c.name,
        accountNo: c.accountNo,
        zone: c.zone,
        period: cycle,
        prevReading: prev,
        presReading: pres,
        consumption: cuM,
        baseAmount: base,
        envFee: env,
        maintFee: maint,
        arrears: 0,
        penalty: 0,
        totalAmount: tot,
        status: 'Ready',
        dueDate: '2026-10-20',
        avatar: c.avatar,
        daysOverdue: 0,
      }
    })

    setBills((prev) => [...generated, ...prev])
    // Align consumers with generated batch readings
    setConsumers((prev) =>
      prev.map((c) => {
        const found = generated.find((g) => g.consumerId === c.id)
        return found ? { ...c, lastReading: found.presReading } : c
      })
    )
    api.batchBills(cycle, targetZone, generated).catch((e) => console.warn('DB batch bills failed', e))
    recordAudit(
      'Billing',
      'Batch Bill Generation Run',
      `${cycle} · Zone: ${targetZone}`,
      `Automated batch billing for verified readings. Generated ${generated.length} invoices.`
    )
  }

  // Action: Recompute Overdue Penalties
  const handleApplyPenalty = () => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.status === 'Overdue' && (b.daysOverdue || 0) >= 3) {
          const newPenalty = +((b.baseAmount + b.arrears) * 0.1).toFixed(2)
          return {
            ...b,
            penalty: newPenalty,
            totalAmount: +(b.baseAmount + b.arrears + newPenalty + b.envFee + b.maintFee).toFixed(2),
          }
        }
        return b
      })
    )
    recordAudit(
      'Arrears',
      'Recomputed Overdue Penalties',
      'Delinquent Accounts Ledger',
      'Applied 10% statutory overdue penalty to all past-due balances.'
    )
  }

  // Action: President Override Bill Due Date & Apply Custom Penalty
  const handleUpdateBillScheduleAndPenalty = async ({ billId, newDueDate, addedArrears, penaltyAmount, reason }) => {
    if (!['President', 'Administrator'].includes(currentUser?.role)) {
      flash('Only the President or Administrator can adjust bill arrears.')
      return false
    }
    const bill = bills.find((item) => item.id === billId)
    if (!bill) {
      flash('The selected bill could not be found. Refresh and try again.')
      return false
    }
    const result = await api.updateBillArrears({
      billId,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      newDueDate,
      addedArrears,
      penaltyAmount,
      reason,
    })
    if (!result?.success || !result.data) {
      flash(`Could not update this bill in the shared database. ${result?.error || 'Refresh and try again.'}`)
      return false
    }
    const updatedBill = {
      ...bill,
      ...result.data,
      avatar: bill.avatar,
    }
    setBills((prev) =>
      prev.map((b) => {
        return b.id === billId
          ? {
              ...b,
              ...updatedBill,
              presidentAdjustmentReason: reason || 'President billing adjustment',
            }
          : b
      })
    )
    recordAudit(
      'Billing',
      'President Billing and Arrears Adjustment',
      `Statement ${billId} (${bill.accountNo})`,
      `Added ₱${Number(addedArrears || 0).toFixed(2)} arrears. New arrears: ₱${Number(updatedBill.arrears).toFixed(2)}. Updated statement total: ₱${Number(updatedBill.totalAmount).toFixed(2)}. Penalty: ₱${Number(updatedBill.penalty).toFixed(2)}. Reason: ${reason || 'President billing adjustment'}.`
    )
    return true
  }

  const handleDeleteBill = async (bill) => {
    if (currentUser?.role !== 'President') {
      flash('Only the President can remove consumer bills.')
      return false
    }

    const result = await api.deleteBill(bill.id, currentUser.fullName, currentUser.role)
    if (!result?.success) {
      flash(result?.error || 'Could not remove the bill.')
      return false
    }

    setBills((previous) => previous.filter((item) => item.id !== bill.id))
    setPayments((previous) => previous.filter((payment) => payment.billId !== bill.id))
    const auditLog = {
      id: `AUD-DEL-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      user: currentUser.fullName,
      role: currentUser.role,
      category: 'Billing',
      action: 'Removed Consumer Bill',
      target: `${bill.id} (${bill.accountNo})`,
      details: `Removed ${bill.status} bill for ${bill.name}. Linked payment records removed: ${result.deletedPayments || 0}.`,
      ip: '',
    }
    setAuditLogs((previous) => [auditLog, ...previous])
    flash(`Bill ${bill.id} was removed.${result.deletedPayments ? ` ${result.deletedPayments} linked payment record(s) were also removed.` : ''}`)
    return true
  }

  // Action: Process Payment at POS
  const handleProcessPayment = async (billId, paymentRecord) => {
    const isPayMongoPayment = typeof paymentRecord.method === 'string'
      && paymentRecord.method.startsWith('PayMongo')
    const paymentMethod = isPayMongoPayment ? 'GCash' : paymentRecord.method
    const paymentResult = await api.processPayment({
      billId,
      orNumber: paymentRecord.orNumber,
      consumerId: paymentRecord.consumerId,
      amountPaid: paymentRecord.amountPaid,
      tendered: paymentRecord.tendered,
      change: paymentRecord.change,
      gatewayReference: paymentRecord.gatewayReference,
      method: paymentMethod,
      notes: [paymentRecord.notes, isPayMongoPayment ? `Settled through ${paymentRecord.method}.` : '']
        .filter(Boolean)
        .join(' '),
      cashier: paymentRecord.cashier || currentUser.fullName,
    })

    if (!paymentResult?.success) {
      throw new Error(paymentResult?.error || 'The payment could not be saved. The bill remains unpaid.')
    }
    const savedPayment = paymentResult.data || {}

    setPayments((prev) => prev.some((payment) => (
      payment.gatewayReference === paymentRecord.gatewayReference
      || (paymentRecord.gatewayReference && payment.notes === paymentRecord.notes)
    )) ? prev : [{ ...paymentRecord, id: savedPayment.id ?? paymentRecord.id, orNumber: savedPayment.orNumber ?? paymentRecord.orNumber }, ...prev])

    // Mark bill as Paid
    setBills((prev) =>
      prev.map((b) => {
        if (b.id === billId) {
          return {
            ...b,
            totalAmount: Number(savedPayment.billTotal ?? b.totalAmount),
            status: savedPayment.status || 'Paid',
            amountDue: Number(savedPayment.remainingAmount ?? 0),
            ...(savedPayment.status === 'Paid' ? {
              paidDate: new Date().toISOString().split('T')[0],
              receiptNo: savedPayment.orNumber || paymentRecord.orNumber,
              penalty: 0,
              arrears: 0,
            } : {}),
          }
        }
        return b
      })
    )

    // Update consumer status if they were overdue
    setConsumers((prev) =>
      prev.map((c) => {
        if (c.id === paymentRecord.consumerId && c.status === 'Overdue') {
          return { ...c, status: 'Active' }
        }
        return c
      })
    )

    // Update map pin
    setGeoPins((prev) =>
      prev.map((p) => {
        if (p.consumerId === paymentRecord.consumerId && p.status === 'Overdue') {
          return { ...p, status: 'Normal' }
        }
        return p
      })
    )

    api.checkDbStatus()
      .then((st) => setDbStatus(st))
      .catch((error) => console.warn('Could not refresh database status after payment:', error))

    recordAudit(
      'Payment',
      savedPayment.status === 'Paid' ? 'Bill Payment Completed' : 'Partial Bill Payment Received',
      paymentRecord.orNumber,
      `Received ₱ ${Number(paymentRecord.amountPaid).toFixed(2)} from ${paymentRecord.consumerName}. Remaining balance: ₱${Number(savedPayment.remainingAmount || 0).toFixed(2)}.`
    )
    return savedPayment
  }

  // Action: Add Complaint / Maintenance Ticket
  const handleAddComplaint = (newComplaint) => {
    setComplaints((prev) => [newComplaint, ...prev])
    api.createTicket(newComplaint).then(() => {
      api.checkDbStatus().then((st) => setDbStatus(st))
    }).catch((e) => console.warn('DB createTicket failed', e))

    recordAudit(
      'Service',
      'Consumer Problem Report Received by Office',
      newComplaint.ticketNo,
      `${newComplaint.issueType} reported for ${newComplaint.consumerName}. Awaiting Office Staff dispatch.`
    )
  }

  // Action: Update Complaint Status
  const handleUpdateComplaintStatus = (ticketId, nextStatus, notes, assignedTo, resolutionImage) => {
    const complaint = complaints.find((item) => item.id === ticketId || item.ticketNo === ticketId)
    const complaintConsumer = complaint && consumers.find((consumer) => consumer.id === complaint.consumerId)
    setComplaints((prev) =>
      prev.map((c) => {
        if (c.id === ticketId) {
          return { ...c, status: nextStatus, notes, ...(assignedTo ? { assignedTo, assignedTech: assignedTo } : {}), ...(resolutionImage ? { resolutionImage } : {}) }
        }
        return c
      })
    )

    // Persist image separately so it survives across user sessions (field staff → consumer)
    if (resolutionImage) {
      try {
        const existing = JSON.parse(localStorage.getItem('lambawasa_resolutionImages') || '{}')
        existing[ticketId] = resolutionImage
        localStorage.setItem('lambawasa_resolutionImages', JSON.stringify(existing))
      } catch { /* quota — image won't persist but session still works */ }
    }

    api.updateTicket({ id: ticketId, status: nextStatus, resolution: notes, assignedTo, resolutionImage: resolutionImage || null }).catch((e) => console.warn('DB updateTicket failed', e))

    if (nextStatus === 'Resolved' && complaint) {
      const notification = {
        id: `NTF-${Date.now()}`,
        type: 'Service Alert',
        recipient: complaint.consumerName || complaintConsumer?.name,
        accountNo: complaint.accountNo || complaintConsumer?.accountNo,
        consumerId: complaint.consumerId,
        ticketId: complaint.id,
        ticketNo: complaint.ticketNo,
        resolutionImage: resolutionImage || null,
        message: `Your reported problem (${complaint.issueType}) has been resolved by Field Staff. ${notes || ''}`.trim(),
        sentAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        status: 'Sent',
        channel: 'System Push',
      }
      setNotifications((prev) => [notification, ...prev])
      api.createNotification(notification).catch((error) => console.warn('DB notification insert failed', error))
    }

    recordAudit(
      'Service',
      `Service Ticket Status -> ${nextStatus}`,
      ticketId,
      `Work progress notes: ${notes}`
    )
  }

  // Action: Dispatch Field Crew from Map
  const handleDispatchCrewFromMap = ({ consumerId, consumerName, zone, issueType, priority, technician }) => {
    const newTicket = {
      id: `TKT-${505 + complaints.length}`,
      ticketNo: `SR-2026-0${184 + complaints.length}`,
      consumerId,
      consumerName,
      accountNo: 'ACC-FIELD',
      zone,
      issueType,
      priority,
      status: 'Dispatched',
      assignedTech: technician,
      reportedAt: new Date().toLocaleString(),
      description: `Rapid dispatch initiated from spatial GIS map.`,
      notes: `Technician ${technician} en route with GPS coordinates.`,
    }
    handleAddComplaint(newTicket)
  }

  // Action: Update or Pin Consumer Location on Google Map
  const handleUpdatePinLocation = ({ consumerId, consumerName, zone, meterNo, lat, lng }) => {
    setGeoPins((prev) => {
      const existing = prev.find((p) => p.consumerId === consumerId)
      if (existing) {
        return prev.map((p) =>
          p.consumerId === consumerId
            ? { ...p, lat, lng, zone }
            : p
        )
      } else {
        return [
          ...prev,
          {
            id: `GP-${prev.length + 1}`,
            consumerId,
            name: consumerName,
            zone,
            lat,
            lng,
            x: 50,
            y: 50,
            status: 'Normal',
            meterNo: meterNo || 'MTR-AUTO',
            reading: 0,
          },
        ]
      }
    })

    recordAudit(
      'Consumer',
      'Pinned Household GPS Coordinates',
      `${consumerName} (${consumerId})`,
      `Set Google Maps coordinate to (${lat.toFixed(5)}, ${lng.toFixed(5)}) in ${zone}.`
    )
  }

  // Action: Approve or Reject Billing Adjustment (President / Admin)
  const handleApproveAdjustment = (adjId, newStatus) => {
    setAdjustments((prev) =>
      prev.map((a) => (a.id === adjId ? { ...a, status: newStatus, approvedBy: currentUser.fullName } : a))
    )
    recordAudit(
      'Billing',
      `Billing Adjustment -> ${newStatus}`,
      adjId,
      `Audited and ${newStatus.toLowerCase()} by ${currentUser.fullName} (${currentUser.role}).`
    )
  }

  // Action: Send Notification
  const handleSendNotification = (newNotification) => {
    setNotifications((prev) => [newNotification, ...prev])
    api.createNotification(newNotification).catch((error) => console.warn('DB notification insert failed', error))
    recordAudit(
      'Service',
      `Dispatched ${newNotification.type}`,
      `${newNotification.recipient} (${newNotification.accountNo})`,
      `Channel: ${newNotification.channel}. Message: "${newNotification.message}"`
    )
  }

  // Action: Add / Update Staff (HR)
  const handleAddStaff = (newStaffMember) => {
    setStaff((prev) => [newStaffMember, ...prev])
    recordAudit(
      'Security',
      'Registered Personnel',
      `${newStaffMember.fullName} (${newStaffMember.role})`,
      `Department: ${newStaffMember.role}. District: ${newStaffMember.zone}.`
    )
  }

  const handleUpdateStaffStatus = (staffId, nextStatus) => {
    setStaff((prev) =>
      prev.map((s) => (s.id === staffId ? { ...s, status: nextStatus } : s))
    )
    recordAudit(
      'Security',
      `Staff Status -> ${nextStatus}`,
      staffId,
      `Updated personnel employment status.`
    )
  }

  // Action: Rate Service (Consumer Portal)
  const handleRateService = (newRating) => {
    setRatings((prev) => [newRating, ...prev])
    recordAudit(
      'Service',
      'Submitted Customer Service Rating',
      `${newRating.consumerName} (${newRating.ticketNo})`,
      `Score: ${newRating.rating}/5. Comments: "${newRating.feedback}"`
    )
  }

  // Inter-module navigation helpers
  const handleOpenPOSWithAccount = (accNo) => {
    setPosPrefillAccount(accNo)
    setActiveNav('Payment P.O.S.')
  }

  const handleOpenCalculatorWithConsumer = (consumer) => {
    setActiveNav('Consumption Calculator')
  }

  const handleOpenMapWithConsumer = (consumerId) => {
    setActiveNav('Geographical Mapping')
  }

  // If user is not logged in, render the public landing page with top right login button
  if (!isLoggedIn) {
    if (isStaffEntryPage) {
      return (
        <div className="app-root-landing">
          <LoginModal
            isOpen={true}
            initialMode="field"
            consumerOnly={false}
            onClose={() => {
              // Keep the direct staff route open until the user successfully signs in.
              // Closing here without a successful login should not reset the session.
            }}
            onOpenRegister={() => setShowRegistrationModal(true)}
            registeredUsers={registeredUsers}
            consumers={consumers}
            onLogin={(user) => {
              setCurrentUser({
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                username: user.username,
                consumerId: user.consumerId,
                accountNo: user.accountNo,
                meterNo: user.meterNo,
                zone: user.zone,
                address: user.address,
                isNewAccount: user.isNewAccount,
                avatar: user.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase(),
              })
              setIsLoggedIn(true)
              if (user.role === 'House Hold') {
                setActiveNav('My Account')
              } else if (user.role === 'Cashier') {
                setActiveNav('Payment P.O.S.')
              } else if (user.role === 'Field Staffs') {
                setActiveNav('Overview')
              } else {
                setActiveNav('Overview')
              }
            }}
            flash={flash}
          />
        </div>
      )
    }

    return (
      <div className="app-root-landing">
        {currentPath === '/consumer' || (import.meta.env.MODE === 'consumer' && currentPath === '/') ? (
          <ConsumerLandingPage
            onOpenLogin={(mode) => {
              setLoginModalMode(mode)
              setShowLoginModal(true)
            }}
            onOpenRegister={() => setShowRegistrationModal(true)}
          />
        ) : (
          <LandingPage
            onOpenLogin={(mode = 'consumer') => {
              setLoginModalMode(mode)
              setShowLoginModal(true)
            }}
            onOpenRegister={() => setShowRegistrationModal(true)}
            onQuickExplore={() => {
              setIsLoggedIn(true)
              flash('Entered operations portal in Quick Demo mode.')
            }}
            flash={flash}
            dbStatus={dbStatus}
            onSync={() => syncFromDatabase(false)}
            isSyncing={isSyncing}
            consumerOnly
          />
        )}
        <LoginModal
          isOpen={showLoginModal}
          initialMode={loginModalMode}
          consumerOnly={false}
          consumerAndFieldOnly={!isStaffEntryPage}
          onClose={() => setShowLoginModal(false)}
          onOpenRegister={() => {
            setShowLoginModal(false)
            setShowRegistrationModal(true)
          }}
          registeredUsers={registeredUsers}
          consumers={consumers}
          onLogin={(user) => {
            setCurrentUser({
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              username: user.username,
              consumerId: user.consumerId,
              accountNo: user.accountNo,
              meterNo: user.meterNo,
              zone: user.zone,
              address: user.address,
              isNewAccount: user.isNewAccount,
              avatar: user.fullName
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase(),
            })
            setShowLoginModal(false)
            setIsLoggedIn(true)
            if (user.role === 'House Hold') {
              setActiveNav('My Account')
            } else if (user.role === 'Cashier') {
              setActiveNav('Payment P.O.S.')
            } else if (user.role === 'Field Staffs') {
              setActiveNav('Overview')
            } else {
              setActiveNav('Overview')
            }
          }}
          flash={flash}
        />
        <RegistrationModal
          isOpen={showRegistrationModal}
          serviceBoundary={serviceBoundary}
          clusterBoundaries={clusterBoundaries}
          onClose={() => setShowRegistrationModal(false)}
          onRegistered={async (user) => {
            // Generate truly unique account credentials — never use consumers.length (stale closure)
            const ts = Date.now()
            const newAccountNo = `ACC-${ts.toString().slice(-6)}`
            const newConsumerId = `C-${ts}`
            const newMeterNo = `MTR-${(ts + Math.floor(Math.random() * 9999)).toString().slice(-6)}`
            const initials = user.fullName
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()

            const newConsumer = {
              id: newConsumerId,
              accountNo: newAccountNo,
              name: user.fullName,
              email: user.email,
              contact: user.mobile,
              zone: user.zone || 'Mabuhay',
              cluster: user.cluster || user.zone || null,
              address: user.address || `${user.zone || 'Mabuhay'} District, Lambawasa`,
              classification: user.classification || 'Residential',
              meterNo: newMeterNo,
              status: 'Pending Approval',
              approvalStatus: 'Pending',
              locationApprovalStatus: 'Approved',
              latitude: user.serviceCoordinates?.lat,
              longitude: user.serviceCoordinates?.lng,
              requestedLatitude: user.serviceCoordinates?.lat,
              requestedLongitude: user.serviceCoordinates?.lng,
              connectionDate: new Date().toISOString().split('T')[0],
              lastReading: 0,
              avatar: initials,
              username: user.username,
              isNewAccount: true,
            }

            // Provision associated meter hardware asset
            const newMeter = {
              serialNo: newMeterNo,
              brand: 'Aquaflow Pro',
              model: 'AF-20-Brass',
              size: '1/2 inch',
              installDate: newConsumer.connectionDate,
              consumerId: newConsumerId,
              consumerName: user.fullName,
              zone: newConsumer.zone,
              cluster: newConsumer.cluster,
              lastCalibration: newConsumer.connectionDate,
              nextCalibration: '2028-09-01',
              status: 'Pending Approval',
              approvalStatus: 'Pending',
              history: [
                {
                  date: newConsumer.connectionDate,
                  type: 'Initial Connection',
                  technician: 'Jamie Dizon',
                  notes: 'New household meter line provisioned.',
                },
              ],
            }

            // Provision spatial map pin
            const newPin = {
              id: `GP-${geoPins.length + 1}`,
              consumerId: newConsumerId,
              name: user.fullName,
              zone: newConsumer.zone,
              lat: user.serviceCoordinates?.lat,
              lng: user.serviceCoordinates?.lng,
              status: 'Normal',
              approvalStatus: 'Pending',
              locationApprovalStatus: 'Approved',
              meterNo: newMeterNo,
              reading: 0,
            }

            // Provision user account record
            const regUserData = {
              ...user,
              id: newConsumerId,
              consumerId: newConsumerId,
              accountNo: newAccountNo,
              meterNo: newMeterNo,
              avatar: initials,
              status: 'Pending Approval',
              isNewAccount: true,
              approvalStatus: 'Pending',
            }

            // Persist first so a failed server registration is not shown as successful.
            const persistenceResponse = await api.addConsumer({
              ...newConsumer,
              latitude: user.serviceCoordinates?.lat,
              longitude: user.serviceCoordinates?.lng,
              approvalStatus: 'Pending',
              status: 'Pending Approval',
            })
            if (!persistenceResponse?.success) {
              throw new Error(persistenceResponse?.error || 'The server rejected the consumer registration.')
            }

            // Save to application states only after the database accepts it.
            setConsumers((prev) => [newConsumer, ...prev])
            setMeters((prev) => [newMeter, ...prev])
            setGeoPins((prev) => [...prev, newPin])
            setRegisteredUsers((prev) => [regUserData, ...prev.filter((item) => item.username !== user.username)])

            // Record audit log
            recordAudit(
              'Consumer',
              'New Household Registration',
              `${user.fullName} (${newAccountNo})`,
              `Self-service registration completed. Meter ${newMeterNo} assigned in ${newConsumer.zone}.`
            )

            setShowRegistrationModal(false)
            flash(`Registration submitted for President approval. ${user.fullName} can sign in after approval.`)
          }}
        />
        {notice && <div className="toast">✓ {notice}</div>}
      </div>
    )
  }

  // ─── HOUSE HOLD CONSUMER PORTAL (Dedicated Full-Page Role View) ───
  if (isHouseholdRole(currentUser.role)) {
    return (
      <ConsumerPortal
        currentUser={currentUser}
        onClearNotifications={(consumerId, accountNo) => {
          setNotifications((prev) => {
            const toRemove = prev.filter((n) => n.consumerId === consumerId || n.accountNo === accountNo)
            // Persist cleared IDs so they stay gone after refresh and DB sync
            const cleared = loadClearedNotificationIds()
            toRemove.forEach((n) => cleared.add(n.id))
            saveClearedNotificationIds(cleared)
            return prev.filter((n) => n.consumerId !== consumerId && n.accountNo !== accountNo)
          })
        }}
        consumers={consumers}
        geoPins={geoPins}
        notifications={notifications}
        bills={bills}
        payments={payments}
        complaints={complaints}
        onPayBillOnline={(billId, pRecord) => handleProcessPayment(billId, pRecord)}
        onFileComplaint={(complaint) => handleAddComplaint(complaint)}
        onUpdateProfile={async ({ email, contact, password }) => {
          setCurrentUser((previous) => ({
            ...previous,
            ...(email ? { email } : {}),
            ...(contact ? { contact, contactNo: contact } : {}),
            ...(password ? { password } : {}),
          }))
          setConsumers((previous) => previous.map((consumer) => (
            consumer.id === currentUser.consumerId || consumer.accountNo === currentUser.accountNo
              ? {
                  ...consumer,
                  ...(email ? { email } : {}),
                  ...(contact ? { contact, contactNo: contact } : {}),
                  ...(password ? { password } : {}),
                }
              : consumer
          )))
          setRegisteredUsers((previous) => previous.map((user) => (
            user.username === currentUser.username || user.accountNo === currentUser.accountNo
              ? {
                  ...user,
                  ...(email ? { email } : {}),
                  ...(contact ? { contact, contactNo: contact } : {}),
                  ...(password ? { password } : {}),
                }
              : user
          )))

          try {
            await api.updateConsumerProfile({
              consumerId: currentUser.consumerId || currentUser.id || currentUser.accountNo,
              accountNo: currentUser.accountNo,
              username: currentUser.username,
              email,
              contact,
              password,
            })
          } catch (err) {
            console.warn('Backend profile update error:', err)
          }
        }}
        onSignOut={() => {
          setIsLoggedIn(false)
          setCurrentUser(DEFAULT_CURRENT_USER)
          setLoginModalMode('consumer')
          setShowLoginModal(true)
        }}
        flash={flash}
      />
    )
  }

  // Filter navigation items by active user role
  const visibleNavItems = allNavItems.filter((item) => item.roles.includes(currentUser.role))


  return (
    <div className={currentUser.role === 'Field Staffs' ? 'app-shell field-staff-shell' : 'app-shell'}>
      {/* Sleek Enterprise Sidebar */}
      <aside className={mobileMenuOpen ? 'sidebar mobile-menu-open' : 'sidebar'}>
        <div className="brand" onClick={() => setActiveNav('Overview')} style={{ cursor: 'pointer' }}>
          <div className="brand-mark">
            <span /><span /><span />
          </div>
          <div>
            <strong>LAMBAWASA</strong>
            <small>Integrated Utility Suite</small>
          </div>
        </div>

        <button
          className="mobile-menu-toggle"
          type="button"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
        >
          <span /><span /><span />
        </button>

        <div className="workspace-label">
          {currentUser.role.toUpperCase()} <span>{visibleNavItems.length} ACTIVE</span>
        </div>

        <nav>
          {visibleNavItems.map(({ id, label, icon: IconComponent }) => {
            let count = 0
            let badgeClass = ''
            if (id === 'Batch Billing') {
              count = bills.filter((b) => b.status === 'Ready').length
            } else if (id === 'Arrears & Penalties') {
              count = bills.filter((b) => b.status === 'Overdue').length
              badgeClass = 'badge-alert-pill'
            } else if (id === 'Service Desk') {
              count = complaints.filter((c) => c.status !== 'Resolved').length
              badgeClass = 'badge-service-pill'
            }

            return (
              <button
                key={id}
                className={activeNav === id ? 'nav-item active' : 'nav-item'}
                aria-label={label}
                title={label}
                onClick={() => {
                  setActiveNav(id)
                  setPosPrefillAccount('')
                  setMobileMenuOpen(false)
                }}
              >
                <i>
                  {typeof IconComponent === 'function' || (typeof IconComponent === 'object' && IconComponent !== null) ? (
                    <IconComponent size={18} strokeWidth={2} />
                  ) : (
                    IconComponent
                  )}
                </i>
                <span>{label}</span>
                {count > 0 && (
                  <b className={`count-badge ${badgeClass}`.trim()}>{count}</b>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main Content Viewport */}
      <main className="main-content">
        {currentUser.role === 'Field Staffs' && (
          <div className="field-staff-floating-nav">
            <FieldStaffNavigation
              activeNav={activeNav}
              onNavigate={(destination) => {
                setActiveNav(destination || 'Overview')
              }}
              complaints={complaints}
              onSignOut={confirmSignOut}
            />
          </div>
        )}

        {/* Topbar */}
        <header className="topbar">
          <div className="breadcrumb">
            <span>Lambawasa System</span>
            <em>/</em>
            <strong>{activeNav}</strong>
          </div>

          {currentUser.role === 'Field Staffs' && (
            <div className="mobile-field-staff-pill">
              <span className="field-role-tag">👷 Field Tech</span>
              <strong className="field-staff-name">{currentUser.fullName.split(' ')[0]}</strong>
              <button
                type="button"
                className="btn-signout-mini"
                onClick={confirmSignOut}
                title="Sign Out"
                aria-label="Sign Out"
              >
                ↪
              </button>
            </div>
          )}

          <div className="top-actions">
            {/* Global Search with Dropdown Results */}
            <div className="global-search-wrap" style={{ position: 'relative' }}>
              <label className="search">
                <span>⌕</span>
                <input
                  value={globalSearch}
                  onChange={(e) => {
                    setGlobalSearch(e.target.value)
                    setGlobalSearchOpen(e.target.value.trim().length > 0)
                  }}
                  onFocus={() => { if (globalSearch.trim()) setGlobalSearchOpen(true) }}
                  onBlur={() => window.setTimeout(() => setGlobalSearchOpen(false), 200)}
                  placeholder="Global account, meter or bill search..."
                />
                {globalSearch && (
                  <button
                    type="button"
                    onClick={() => { setGlobalSearch(''); setGlobalSearchOpen(false) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', color: '#aaa', fontSize: '14px' }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </label>

              {/* Dropdown Results Panel */}
              {globalSearchOpen && globalSearch.trim().length > 0 && (() => {
                const q = globalSearch.trim().toLowerCase()
                const matchedConsumers = consumers.filter((c) =>
                  `${c.name} ${c.accountNo} ${c.meterNo} ${c.address} ${c.zone}`.toLowerCase().includes(q)
                ).slice(0, 4)
                const matchedBills = bills.filter((b) =>
                  `${b.id} ${b.accountNo} ${b.name}`.toLowerCase().includes(q)
                ).slice(0, 3)
                const matchedMeters = meters.filter((m) =>
                  `${m.serialNo} ${m.consumerName} ${m.brand} ${m.zone}`.toLowerCase().includes(q)
                ).slice(0, 3)
                const hasResults = matchedConsumers.length > 0 || matchedBills.length > 0 || matchedMeters.length > 0
                return (
                  <div className="global-search-dropdown" style={{
                    position: 'absolute', top: '100%', right: 0, width: '360px', background: '#1a2332',
                    border: '1px solid #2a3a50', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    zIndex: 9999, marginTop: '6px', maxHeight: '420px', overflowY: 'auto',
                  }}>
                    {!hasResults && (
                      <div style={{ padding: '16px', color: '#7a8fa6', fontSize: '13px', textAlign: 'center' }}>
                        No results for "{globalSearch}"
                      </div>
                    )}

                    {matchedConsumers.length > 0 && (
                      <>
                        <div style={{ padding: '8px 14px 4px', fontSize: '10px', color: '#4fc3f7', letterSpacing: '1px', fontWeight: 700, textTransform: 'uppercase' }}>
                          👤 Consumers
                        </div>
                        {matchedConsumers.map((c) => (
                          <div
                            key={c.id}
                            onMouseDown={() => {
                              setGlobalNavSearch(globalSearch)
                              setGlobalSearch('')
                              setGlobalSearchOpen(false)
                              setActiveNav('Household Profiling')
                            }}
                            style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #1e2d3d', display: 'flex', alignItems: 'center', gap: '10px' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#1e2d3d'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize: '18px' }}>{c.avatar || '👤'}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#e8f0fe', fontSize: '13px', fontWeight: 600 }}>{c.name}</div>
                              <div style={{ color: '#7a8fa6', fontSize: '11px' }}>{c.accountNo} · {c.zone} · {c.status}</div>
                            </div>
                            <span style={{ color: '#4fc3f7', fontSize: '11px' }}>View ❯</span>
                          </div>
                        ))}
                      </>
                    )}

                    {matchedBills.length > 0 && (
                      <>
                        <div style={{ padding: '8px 14px 4px', fontSize: '10px', color: '#a5d6a7', letterSpacing: '1px', fontWeight: 700, textTransform: 'uppercase' }}>
                          🧾 Bills
                        </div>
                        {matchedBills.map((b) => (
                          <div
                            key={b.id}
                            onMouseDown={() => {
                              setPosPrefillAccount(b.accountNo)
                              setGlobalSearch('')
                              setGlobalSearchOpen(false)
                              setActiveNav('Payment P.O.S.')
                            }}
                            style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #1e2d3d', display: 'flex', alignItems: 'center', gap: '10px' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#1e2d3d'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize: '18px' }}>🧾</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#e8f0fe', fontSize: '13px', fontWeight: 600 }}>{b.name}</div>
                              <div style={{ color: '#7a8fa6', fontSize: '11px' }}>{b.id} · {b.accountNo} · ₱{b.totalAmount?.toFixed(2)} · <span style={{ color: b.status === 'Paid' ? '#a5d6a7' : '#ffab91' }}>{b.status}</span></div>
                            </div>
                            <span style={{ color: '#a5d6a7', fontSize: '11px' }}>Pay ❯</span>
                          </div>
                        ))}
                      </>
                    )}

                    {matchedMeters.length > 0 && (
                      <>
                        <div style={{ padding: '8px 14px 4px', fontSize: '10px', color: '#ffe082', letterSpacing: '1px', fontWeight: 700, textTransform: 'uppercase' }}>
                          ▣ Meters
                        </div>
                        {matchedMeters.map((m) => (
                          <div
                            key={m.serialNo}
                            onMouseDown={() => {
                              setGlobalNavSearch(globalSearch)
                              setGlobalSearch('')
                              setGlobalSearchOpen(false)
                              setActiveNav('Meter Assets')
                            }}
                            style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #1e2d3d', display: 'flex', alignItems: 'center', gap: '10px' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#1e2d3d'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <span style={{ fontSize: '18px' }}>🔩</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#e8f0fe', fontSize: '13px', fontWeight: 600 }}>{m.serialNo}</div>
                              <div style={{ color: '#7a8fa6', fontSize: '11px' }}>{m.consumerName} · {m.brand} {m.model} · {m.status}</div>
                            </div>
                            <span style={{ color: '#ffe082', fontSize: '11px' }}>View ❯</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* User Profile & Sign Out in Upper Right */}
            <div className="topbar-user-section">
              <div
                className="topbar-user-chip"
                onClick={confirmSignOut}
                title="Click to Sign Out"
              >
                <div className="avatar user">{currentUser.avatar || 'JD'}</div>
                <div className="topbar-user-details">
                  <strong>{currentUser.fullName}</strong>
                  <small>{currentUser.role}</small>
                </div>
              </div>
              <button
                type="button"
                className="topbar-signout-btn"
                onClick={confirmSignOut}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut size={16} strokeWidth={2.2} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Content Views */}
        <div className="content-wrap">
          {notice && <div className="toast">✓ {notice}</div>}

          {/* 0. Executive Overview */}
          {currentUser.role === 'Field Staffs' && activeNav === 'Overview' && (
            <FieldStaffPortal
              currentUser={currentUser}
              consumers={consumers}
              geoPins={geoPins}
              clusterBoundaries={clusterBoundaries}
              meters={meters}
              complaints={complaints}
              pendingMeterReadings={pendingMeterReadings}
              initialTrackedTicketId={fieldTrackedTicketId}
              onNavigate={setActiveNav}
              onSignOut={() => {
                setIsLoggedIn(false)
                flash('Field staff signed out.')
              }}
            />
          )}

          {currentUser.role !== 'Field Staffs' && activeNav === 'Overview' && (
            <OverviewDashboard
              currentUser={currentUser}
              consumers={consumers}
              bills={bills}
              payments={payments}
              complaints={complaints}
              onNavigate={setActiveNav}
              onOpenRegisterModal={() => setActiveNav('Household Profiling')}
              flash={flash}
            />
          )}


          {/* FDD 1. Reports Module */}
          {activeNav === 'Reports' && (
            <ReportsModule
              consumers={consumers}
              bills={bills}
              payments={payments}
              complaints={complaints}
              auditLogs={auditLogs}
              adjustments={adjustments}
              staff={staff}
              currentUser={currentUser}
              clusterBoundaries={clusterBoundaries}
              onApproveAdjustment={handleApproveAdjustment}
              flash={flash}
            />
          )}

          {/* FDD 2. Notifications Module */}
          {activeNav === 'Notifications' && (
            <NotificationsModule
              consumers={consumers}
              bills={bills}
              notifications={notifications}
              onSendNotification={handleSendNotification}
              flash={flash}
            />
          )}

          {/* FDD 3. Staff Module */}
          {activeNav === 'Staff Management' && (
            <HRModule
              staff={staff}
              complaints={complaints}
              clusterBoundaries={clusterBoundaries}
              consumers={consumers}
              onAddStaff={handleAddStaff}
              onUpdateStaffStatus={handleUpdateStaffStatus}
              flash={flash}
            />
          )}

          {/* 1. Household Profiling System */}
          {activeNav === 'Household Profiling' && (
            <HouseholdProfiling
              consumers={consumers}
              onAddConsumer={handleAddConsumer}
              onOpenPOS={handleOpenPOSWithAccount}
              currentUser={currentUser}
              geoPins={geoPins}
              onUpdateConsumerApproval={handleUpdateConsumerApproval}
              onDeleteConsumer={handleDeleteConsumer}
              onRequestConsumerLocationChange={handleRequestConsumerLocationChange}
              onDecideConsumerLocationChange={handleDecideConsumerLocationChange}
              onRecordMeterReading={handleRecordMeterReading}
              onOpenCalculator={handleOpenCalculatorWithConsumer}
              onOpenMap={handleOpenMapWithConsumer}
              initialSearch={globalNavSearch}
              clusterBoundaries={clusterBoundaries}
              flash={flash}
            />
          )}

          {/* 2. Meter Asset Logging */}
          {activeNav === 'Meter Assets' && (
            <MeterAssetLogging
              meters={meters}
              consumers={consumers}
              currentUser={currentUser}
              pendingMeterReadings={pendingMeterReadings}
              bills={bills}
              onUpdateMeter={handleUpdateMeter}
              onAddMeter={handleAddMeter}
              onDeleteMeter={handleDeleteMeter}
              onRecordMeterReading={handleRecordMeterReading}
              onConfirmMeterReading={handleConfirmMeterReading}
              onRejectMeterReading={handleRejectMeterReading}
              initialSearch={globalNavSearch}
              clusterBoundaries={clusterBoundaries}
              flash={flash}
            />
          )}

          {/* 3. Geographical Mapping */}
          {activeNav === 'Geographical Mapping' && (
            <GeographicalMapping
              currentUser={currentUser}
              isFieldStaff={currentUser.role === 'Field Staffs'}
              pins={geoPins}
              consumers={consumers}
              serviceBoundary={serviceBoundary}
              onUpdateServiceBoundary={handleUpdateServiceBoundary}
              clusterBoundaries={clusterBoundaries}
              onUpdateClusterBoundaries={handleUpdateClusterBoundaries}
              canEditBoundary={['Administrator', 'President'].includes(currentUser.role)}
              onDispatchCrew={handleDispatchCrewFromMap}
              onViewConsumer={(cId) => setActiveNav('Household Profiling')}
              onUpdatePinLocation={handleUpdatePinLocation}
              trackedTicket={complaints.find((ticket) => ticket.id === fieldTrackedTicketId) || null}
              flash={flash}
            />
          )}

          {/* 4. Automated Consumption Calculator */}
          {activeNav === 'Consumption Calculator' && (
            <AutomatedConsumptionCalculator
              consumers={consumers}
              currentUser={currentUser}
              onRecordMeterReading={handleRecordMeterReading}
              onPresidentCorrectReading={handlePresidentCorrectReading}
              flash={flash}
            />
          )}

          {/* 5. Batch Bill Generation */}
          {activeNav === 'Batch Billing' && (
            <BatchBillGeneration
              bills={bills}
              currentUser={currentUser}
              onUpdateBillScheduleAndPenalty={handleUpdateBillScheduleAndPenalty}
              onDeleteBill={handleDeleteBill}
              onOpenPOS={handleOpenPOSWithAccount}
              flash={flash}
            />
          )}

          {/* 6. Arrears & Penalty Tracker */}
          {activeNav === 'Arrears & Penalties' && (
            <ArrearsPenaltyTracker
              bills={bills}
              onApplyPenalty={handleApplyPenalty}
              onOpenPOS={handleOpenPOSWithAccount}
              flash={flash}
            />
          )}

          {/* 7. Payment P.O.S. */}
          {activeNav === 'Payment P.O.S.' && (
            <PaymentPOS
              bills={bills}
              payments={payments}
              prefillAccount={posPrefillAccount}
              onProcessPayment={handleProcessPayment}
              flash={flash}
            />
          )}

          {/* 8. Operational Audit Trail */}
          {activeNav === 'Operational Audit Trail' && (
            <OperationalAuditTrail
              auditLogs={auditLogs}
              flash={flash}
            />
          )}

          {/* 9. Maintenance and Complaint Log */}
          {activeNav === 'Service Desk' && (
            <MaintenanceComplaintLog
              currentUser={currentUser}
              complaints={complaints}
              consumers={consumers}
              onAddComplaint={handleAddComplaint}
              onUpdateComplaintStatus={handleUpdateComplaintStatus}
              onTrackTicket={handleTrackTicket}
              flash={flash}
            />
          )}
        </div>

        {/* Field Staff Mobile Bottom Navigation Bar */}
        {currentUser.role === 'Field Staffs' && (
          <nav className="field-staff-mobile-bottom-nav" aria-label="Field Staff Quick Navigation">
            <button
              type="button"
              className={activeNav === 'Consumption Calculator' ? 'field-nav-btn active' : 'field-nav-btn'}
              onClick={() => {
                setActiveNav('Consumption Calculator')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <span className="field-nav-icon">🧮</span>
              <span className="field-nav-label">Read Meter</span>
            </button>

            <button
              type="button"
              className={activeNav === 'Meter Assets' ? 'field-nav-btn active' : 'field-nav-btn'}
              onClick={() => {
                setActiveNav('Meter Assets')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <span className="field-nav-icon">▣</span>
              <span className="field-nav-label">Meters</span>
            </button>

            <button
              type="button"
              className={activeNav === 'Geographical Mapping' ? 'field-nav-btn active' : 'field-nav-btn'}
              onClick={() => {
                setActiveNav('Geographical Mapping')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <span className="field-nav-icon">🗺️</span>
              <span className="field-nav-label">Field Map</span>
            </button>

            <button
              type="button"
              className={activeNav === 'Service Desk' ? 'field-nav-btn active' : 'field-nav-btn'}
              onClick={() => {
                setActiveNav('Service Desk')
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              <span className="field-nav-icon">🛠️</span>
              <span className="field-nav-label">Tickets</span>
              {complaints.filter((c) => c.status !== 'Resolved').length > 0 && (
                <span className="field-nav-badge">
                  {complaints.filter((c) => c.status !== 'Resolved').length}
                </span>
              )}
            </button>
          </nav>
        )}
      </main>

      {/* ── Sign Out Confirmation Modal ── */}
      {showSignOutConfirm && (
        <div
          className="modal-backdrop"
          onClick={() => setShowSignOutConfirm(false)}
          style={{ zIndex: 99999 }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '360px', textAlign: 'center' }}
          >
            <div className="modal-title-wrap">
              <h2 style={{ marginTop: '8px' }}>Sign Out?</h2>
              <p className="modal-copy">
                You'll be returned to the login screen. Any unsaved changes will remain in the system.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
              <button
                className="btn-outline-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowSignOutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                style={{ flex: 1, justifyContent: 'center', background: '#ef4444' }}
                onClick={() => doSignOut()}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
