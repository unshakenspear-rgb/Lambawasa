import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CreditCard,
  FileText,
  Receipt,
  BarChart3,
  Droplets,
  Wrench,
  User,
  Bell,
  Home,
  LogOut,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
  Search,
  ArrowUpRight,
  ShieldCheck,
  MapPin,
  Clock,
  AlertCircle
} from 'lucide-react'
import L from '../services/leaflet'
import 'leaflet/dist/leaflet.css'
import './ConsumerPortal.css'
import gcashOfficialLogo from '../assets/gcash-official.svg'
import { api } from '../services/api'

const createPaymentIdentifiers = () => {
  const timestamp = Date.now()
  return {
    id: `PAY-${timestamp}`,
    orNumber: `OR-${new Date().getFullYear()}-${timestamp}`,
  }
}

export default function ConsumerPortal({
  currentUser,
  consumers = [],
  geoPins = [],
  bills = [],
  payments = [],
  complaints = [],
  notifications = [],
  onPayBillOnline,
  onFileComplaint,
  onUpdateProfile,
  onClearNotifications,
  onSignOut,
  flash,
}) {
  // Navigation & View States
  const [activeTab, setActiveTab] = useState('home') // 'home' | 'bills' | 'usage' | 'service' | 'account' | 'history'
  const [activeModal, setActiveModal] = useState(null) // 'pay' | 'receipt' | 'ticket' | 'meter' | 'dossier' | 'notice' | 'reportSent'
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [hideBalance, setHideBalance] = useState(false)
  const [copiedAccount, setCopiedAccount] = useState(false)
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [submittedReport, setSubmittedReport] = useState(null)
  const [profileEmail, setProfileEmail] = useState(currentUser.email || '')
  const [profileContact, setProfileContact] = useState(currentUser.contact || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const profileMapRef = useRef(null)
  const profileMapInstanceRef = useRef(null)
  const paymongoVerificationInProgressRef = useRef(false)
  const paymongoCheckoutStorageKey = `paymongo-checkout:${currentUser.accountNo || currentUser.consumerId || currentUser.username || 'consumer'}`

  // Payment Form States
  const [payMethod, setPayMethod] = useState('PayMongo')
  const [payContact, setPayContact] = useState(currentUser.contact || '')
  const [isPaying, setIsPaying] = useState(false)
  const [paymongoConfig, setPaymongoConfig] = useState(null)
  const [paymongoVerificationMessage, setPaymongoVerificationMessage] = useState('')
  const [paymongoCheckout, setPaymongoCheckout] = useState(() => {
    try {
      const savedCheckout = sessionStorage.getItem(paymongoCheckoutStorageKey)
      const checkout = savedCheckout ? JSON.parse(savedCheckout) : null
      const checkoutUrl = new URL(checkout?.checkoutUrl)

      return checkout?.sessionId
        && checkout?.billId
        && checkoutUrl.origin === 'https://checkout.paymongo.com'
        ? checkout
        : null
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError) {
        return null
      }
      console.error('Could not restore PayMongo checkout session:', error)
      return null
    }
  })
  const paymongoCheckoutUrl = paymongoCheckout?.checkoutUrl || null
  const paymongoSessionId = paymongoCheckout?.sessionId || null

  useEffect(() => {
    if (activeModal !== 'pay') return undefined

    let isCurrent = true
    api.getPaymongoConfig().then((config) => {
      if (isCurrent) setPaymongoConfig(config)
    })
    return () => {
      isCurrent = false
    }
  }, [activeModal])

  // Complaint Form States
  const [issueType, setIssueType] = useState('Low Water Pressure')
  const [customIssueType, setCustomIssueType] = useState('')
  const [description, setDescription] = useState('')
  const [landmarkLocation, setLandmarkLocation] = useState(currentUser.address || '')

  useEffect(() => {
    try {
      if (paymongoCheckout) {
        sessionStorage.setItem(paymongoCheckoutStorageKey, JSON.stringify(paymongoCheckout))
      } else {
        sessionStorage.removeItem(paymongoCheckoutStorageKey)
      }
    } catch (error) {
      console.error('Could not save PayMongo checkout session:', error)
    }
  }, [paymongoCheckout, paymongoCheckoutStorageKey])

  // Identify active consumer record — match strictly by ID or accountNo only.
  // Never fall through to fullName (too loose) to avoid showing another consumer's data.
  const activeConsumer =
    consumers.find(
      (c) =>
        (currentUser.consumerId && c.id === currentUser.consumerId) ||
        (currentUser.accountNo && c.accountNo === currentUser.accountNo) ||
        (currentUser.username && c.username?.toLowerCase() === currentUser.username.toLowerCase())
    ) || {
      // Fallback built entirely from currentUser — never shows another consumer's data
      id: currentUser.consumerId || '',
      accountNo: currentUser.accountNo || '',
      name: currentUser.fullName || '',
      contact: currentUser.contact || '',
      address: currentUser.address || '',
      email: currentUser.email || '',
      zone: currentUser.zone || '',
      classification: currentUser.classification || 'Residential',
      meterNo: currentUser.meterNo || '',
      status: currentUser.isNewAccount ? 'Pending Approval' : 'Active',
      connectionDate: '',
      lastReading: 0,
      avatar: currentUser.avatar || '',
    }

  const activeGeoPin = geoPins.find(
    (pin) => pin.consumerId === activeConsumer.id
      || pin.consumerId === currentUser.consumerId
      || pin.name?.toLowerCase() === activeConsumer.name?.toLowerCase()
  )
  const profileCoordinates = activeGeoPin && {
    lat: Number(activeGeoPin.lat ?? activeGeoPin.latitude),
    lng: Number(activeGeoPin.lng ?? activeGeoPin.longitude),
  }

  useEffect(() => {
    if (activeModal !== 'dossier' || !profileMapRef.current || !profileCoordinates?.lat || !profileCoordinates?.lng) return undefined

    const map = L.map(profileMapRef.current, {
      center: [profileCoordinates.lat, profileCoordinates.lng],
      zoom: 16,
      zoomControl: true,
      attributionControl: true,
    })
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: 'Map data &copy; Google Maps',
    }).addTo(map)
    L.marker([profileCoordinates.lat, profileCoordinates.lng])
      .addTo(map)
      .bindPopup(`${activeConsumer.name}<br />Registered service location`)
      .openPopup()
    profileMapInstanceRef.current = map
    window.setTimeout(() => map.invalidateSize(), 0)

    return () => {
      map.remove()
      profileMapInstanceRef.current = null
    }
  }, [activeModal, activeConsumer.id, profileCoordinates?.lat, profileCoordinates?.lng])

  // Filter relational data for active household
  const myBills = bills.filter(
    (b) =>
      b.accountNo === activeConsumer.accountNo ||
      (activeConsumer.id && b.consumerId === activeConsumer.id)
  )
  const myPayments = payments.filter(
    (p) =>
      p.accountNo === activeConsumer.accountNo ||
      (activeConsumer.id && p.consumerId === activeConsumer.id)
  )
  const myComplaints = complaints.filter(
    (c) =>
      c.accountNo === activeConsumer.accountNo ||
      (activeConsumer.id && c.consumerId === activeConsumer.id)
  )
  const myNotifications = notifications.filter(
    (notification) => notification.consumerId === activeConsumer.id
      || notification.accountNo === activeConsumer.accountNo
      || notification.recipient === activeConsumer.name
  )
  const isNewConsumer = Boolean(activeConsumer.isNewAccount || currentUser.isNewAccount)
  const getBillBalance = (bill) => {
    const paid = myPayments
      .filter((payment) => payment.billId === bill.id)
      .reduce((total, payment) => total + Number(payment.amountPaid || 0), 0)
    return Math.max(0, Number((Number(bill.totalAmount || 0) - paid).toFixed(2)))
  }

  useEffect(() => {
    if (activeConsumer.address && !landmarkLocation) {
      setLandmarkLocation(activeConsumer.address)
    }
    if (activeConsumer.contact && !profileContact) {
      setProfileContact(activeConsumer.contact)
    }
    if (activeConsumer.contact && !payContact) {
      setPayContact(activeConsumer.contact)
    }
    if (activeConsumer.email && !profileEmail) {
      setProfileEmail(activeConsumer.email)
    }
  }, [activeConsumer.address, activeConsumer.contact, activeConsumer.email, landmarkLocation, profileContact, payContact, profileEmail])

  const handleProfileUpdate = (event) => {
    event.preventDefault()
    if (newPassword && newPassword.length < 8) {
      if (flash) flash('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      if (flash) flash('New passwords do not match.')
      return
    }

    setNewPassword('')
    setConfirmNewPassword('')
    if (profileContact.trim()) {
      setPayContact(profileContact.trim())
    }
    if (onUpdateProfile) {
      onUpdateProfile({
        email: profileEmail.trim(),
        contact: profileContact.trim(),
        password: newPassword || undefined,
      })
    }
    if (flash) flash('Profile contact & details updated successfully.')
  }

  const unpaidBill = myBills.find(
    (bill) => (bill.status === 'Ready' || bill.status === 'Overdue') && getBillBalance(bill) > 0
  )
  const unpaidAmount = unpaidBill ? getBillBalance(unpaidBill) : 0
  const activeCheckoutBill = paymongoCheckout
    ? myBills.find((bill) => bill.id === paymongoCheckout.billId)
    : null
  const hasCurrentStatement = Boolean(unpaidBill)
  const latestBill = unpaidBill || {
    id: null,
    totalAmount: 0,
    consumption: 0,
    dueDate: null,
    status: 'No Statement',
    period: 'Current billing cycle',
    baseAmount: 0,
    envFee: 0,
    maintFee: 0,
    arrears: 0,
    penalty: 0,
  }

  // Consumers with arrears, overdue penalties, or Overdue status cannot pay via online GCash (must be over-the-counter)
  const hasArrearsOrPenalty = Boolean(
    (Number(latestBill.arrears || 0) > 0) ||
    (Number(latestBill.penalty || 0) > 0) ||
    (latestBill.status === 'Overdue')
  )
  const isBelowPaymongoMinimum = Boolean(
    unpaidBill && unpaidAmount < 20
  )

  const receiptBill = selectedReceipt
    ? myBills.find((bill) => bill.id === selectedReceipt.billId)
    : null

  useEffect(() => {
    if (activeCheckoutBill?.status === 'Paid') {
      setPaymongoCheckout(null)
    }
  }, [activeCheckoutBill?.status])
  const receiptPenalty = Number(selectedReceipt?.penalty ?? receiptBill?.penalty ?? 0)
  const receiptPreviousReading = Number(selectedReceipt?.prevReading ?? receiptBill?.prevReading ?? 0)
  const receiptPresentReading = Number(selectedReceipt?.presReading ?? receiptBill?.presReading ?? 0)
  const receiptConsumption = Number(selectedReceipt?.consumption ?? receiptBill?.consumption ?? Math.max(0, receiptPresentReading - receiptPreviousReading))

  // Copy account number
  const handleCopyAccount = () => {
    navigator.clipboard.writeText(activeConsumer.accountNo)
    setCopiedAccount(true)
    setTimeout(() => setCopiedAccount(false), 2000)
    if (flash) flash(`Account number ${activeConsumer.accountNo} copied to clipboard!`)
  }

  // Submit Online Payment via PayMongo Gateway
  const handlePaySubmit = async (e) => {
    e.preventDefault()
    if (!unpaidBill) {
      if (flash) flash(hasCurrentStatement ? 'All statement obligations are settled!' : 'No payable statement is available yet. Billing is calculated at month-end.')
      return
    }

    if (hasArrearsOrPenalty) {
      if (flash) flash('Accounts with arrears or overdue penalties cannot be paid online. Settlement must be made over the counter at the municipal cashier.')
      return
    }

    const billToPay = unpaidBill
    if (!paymongoConfig?.configured) {
      const errorMessage = paymongoConfig?.error
        || 'Checking PayMongo configuration. Please wait a moment and try again.'
      setPaymongoVerificationMessage(errorMessage)
      if (flash) flash(errorMessage)
      return
    }
    if (unpaidAmount < 20) {
      if (flash) flash('PayMongo requires at least ₱20.00. Please pay this bill for its exact amount at the cashier.')
      return
    }
    setIsPaying(true)

    try {
      // 1. Initialize Checkout Session with PayMongo
      const effectiveContact = payContact.trim() || activeConsumer.contact || currentUser.contact || ''
      const checkoutRes = await api.createPaymongoCheckout({
        billId: billToPay.id,
        consumerName: activeConsumer.name,
        consumerEmail: activeConsumer.email || currentUser.email || '',
        consumerPhone: effectiveContact,
        accountNo: activeConsumer.accountNo,
        amount: unpaidAmount,
        description: `Water Statement ${billToPay.id} (${activeConsumer.accountNo}) - Lambawasa Water`,
      })

      if (checkoutRes?.success && checkoutRes.checkoutUrl && checkoutRes.sessionId) {
        const checkout = {
          checkoutUrl: checkoutRes.checkoutUrl,
          sessionId: checkoutRes.sessionId,
          billId: billToPay.id,
          accountNo: activeConsumer.accountNo,
          amount: Number(checkoutRes.amount ?? unpaidAmount),
          mode: checkoutRes.mode,
        }
        try {
          sessionStorage.setItem(paymongoCheckoutStorageKey, JSON.stringify(checkout))
        } catch (error) {
          console.error('Could not persist PayMongo checkout session:', error)
        }
        setPaymongoCheckout(checkout)
        setPaymongoVerificationMessage('')

        // Open PayMongo Secure Checkout page in a new tab for seamless consumer experience
        window.open(checkoutRes.checkoutUrl, '_blank', 'noopener,noreferrer')
        if (flash) flash(
          checkout.mode === 'test'
            ? 'PayMongo is in test mode. This checkout will not move real money or create a payout. Configure a live secret key to accept real payments.'
            : 'PayMongo Checkout window opened. Please complete your payment in GCash, Maya, GrabPay, or Card!'
        )
      } else {
        console.warn('PayMongo checkout init error:', checkoutRes?.error)
        if (flash) flash(checkoutRes?.error || 'PayMongo could not start checkout. No payment was recorded; please try again later.')
      }
    } catch (err) {
      console.error('handlePaySubmit error:', err)
      if (flash) flash('Payment processing error: ' + err.message)
    } finally {
      setIsPaying(false)
    }
  }

  // Verify and finalize PayMongo session payment
  const handleVerifyAndFinalizePayment = async () => {
    if (paymongoVerificationInProgressRef.current) {
      setPaymongoVerificationMessage('Payment verification is already in progress. Please wait for the result.')
      return
    }
    if (!paymongoSessionId || !paymongoCheckout) {
      setPaymongoVerificationMessage('Checkout details are missing. Reopen the checkout from this account and try again.')
      return
    }
    paymongoVerificationInProgressRef.current = true
    setPaymongoVerificationMessage('Checking your payment with PayMongo…')
    setIsPaying(true)

    try {
      const verifyRes = await api.verifyPaymongoSession(paymongoSessionId)
      if (!verifyRes?.success) {
        throw new Error(verifyRes?.error || 'Could not verify this payment with PayMongo. Please try again.')
      }
      if (verifyRes.status !== 'paid') {
        const message = 'PayMongo has not confirmed this payment yet. Complete the checkout, then try Verify & Complete again.'
        setPaymongoVerificationMessage(message)
        if (flash) flash(message)
        return
      }
      if (
        !verifyRes.billFound
        || verifyRes.billId !== paymongoCheckout.billId
        || verifyRes.accountNo !== paymongoCheckout.accountNo
        || verifyRes.accountNo !== activeConsumer.accountNo
      ) {
        const message = 'This confirmed checkout does not match the current consumer account and bill. No receipt was issued. Please contact the cashier to reconcile it.'
        setPaymongoVerificationMessage(message)
        if (flash) flash(message)
        return
      }
      if (!verifyRes.amountMatchesBill) {
        const verifiedAmount = Number(verifyRes.sessionAmount)
        const message = verifiedAmount > 0
          ? `The confirmed checkout amount (₱${verifiedAmount.toFixed(2)}) does not match the remaining balance for bill ${verifyRes.billId} (₱${Number(verifyRes.remainingAmount || 0).toFixed(2)}). No receipt was issued.`
          : 'PayMongo confirmed the checkout, but its transaction amount was not included in the response. No receipt was issued. Please try Verify & Complete again.'
        setPaymongoVerificationMessage(message)
        if (flash) flash(message)
        return
      }

      const billToPay = activeCheckoutBill
      if (!billToPay) {
        const message = 'PayMongo confirmed this payment, but the bill is not loaded in this portal yet. Refresh the page and verify again; the payment will not be charged again.'
        setPaymongoVerificationMessage(message)
        if (flash) flash(message)
        return
      }
      setPaymongoVerificationMessage('Payment confirmed. Saving your bill payment…')
      const paidMethodName = `PayMongo (${verifyRes.paymentMethod || 'Online'})`

      const { id: paymentId, orNumber } = createPaymentIdentifiers()
      const paymentRecord = {
        id: paymentId,
        orNumber,
        gatewayReference: paymongoSessionId,
        billId: billToPay.id,
        consumerId: activeConsumer.id,
        consumerName: activeConsumer.name,
        accountNo: activeConsumer.accountNo,
        amountPaid: Number(verifyRes.sessionAmount),
        penalty: billToPay.penalty || 0,
        arrears: billToPay.arrears || 0,
        prevReading: billToPay.prevReading || 0,
        presReading: billToPay.presReading || 0,
        consumption: billToPay.consumption || 0,
        tendered: Number(verifyRes.sessionAmount),
        change: 0.0,
        method: paidMethodName,
        date: new Date().toISOString().replace('T', ' ').slice(0, 19),
        cashier: `PayMongo Payment Gateway`,
        notes: `PayMongo Checkout verified settlement (${paymongoSessionId || 'Session'}).`,
      }

      if (!onPayBillOnline) {
        throw new Error('Payment saving is unavailable. The bill remains unpaid.')
      }
      const paymentResult = await onPayBillOnline(billToPay.id, paymentRecord)
      const paymentSaved = Boolean(paymentResult)
      if (!paymentSaved) {
        throw new Error('Payment could not be saved. The bill remains unpaid.')
      }
      const finalizedPaymentRecord = {
        ...paymentRecord,
        id: paymentResult.id ?? paymentRecord.id,
        orNumber: paymentResult.orNumber ?? paymentRecord.orNumber,
        amountPaid: Number(paymentResult.amountPaid ?? paymentRecord.amountPaid),
        remainingAmount: Number(paymentResult.remainingAmount ?? 0),
      }

      setPaymongoCheckout(null)
      setPaymongoVerificationMessage('')
      setSelectedReceipt(finalizedPaymentRecord)
      setActiveModal('receipt')
      if (flash) flash(
        Number(paymentResult.remainingAmount) > 0
          ? `₱${Number(paymentResult.amountPaid).toFixed(2)} credited. ₱${Number(paymentResult.remainingAmount).toFixed(2)} remains due. Receipt ${finalizedPaymentRecord.orNumber} issued.`
          : `Payment verified! Official Receipt ${finalizedPaymentRecord.orNumber} issued.`
      )
    } catch (err) {
      setPaymongoVerificationMessage(err.message || 'Payment confirmation failed. Please try again.')
      if (flash) flash('Could not verify payment: ' + err.message)
    } finally {
      paymongoVerificationInProgressRef.current = false
      setIsPaying(false)
    }
  }

  // Submit Complaint / Service Ticket (Aligned with Field Staff Service Desk)
  const handleComplaintSubmit = (e) => {
    e.preventDefault()
    const submittedIssueType = issueType === 'Other' ? customIssueType.trim() : issueType
    if (issueType === 'Other' && !submittedIssueType) {
      if (flash) flash('Please describe the problem you want to report.')
      return
    }
    const newTicketNo = `SR-2026-0${190 + complaints.length}`
    const newTicket = {
      id: newTicketNo,
      ticketNo: newTicketNo,
      consumerId: activeConsumer.id,
      consumerName: activeConsumer.name,
      accountNo: activeConsumer.accountNo,
      zone: activeConsumer.zone,
      issueType: submittedIssueType,
      priority: 'Medium',
      status: 'Reported',
      assignedTech: 'Office Staff Intake',
      assignedTo: 'Office Staff Intake',
      reportedAt: new Date().toLocaleString(),
      description: description.trim() || submittedIssueType,
      notes: 'Received by Office Staff for review and dispatch.',
      resolution: 'Queued for mobile inspection van.',
    }

    if (onFileComplaint) {
      onFileComplaint(newTicket)
    }
    setSubmittedReport(newTicket)
    setDescription('')
    setLandmarkLocation(activeConsumer.address || '')
    setCustomIssueType('')
    setIssueType('Low Water Pressure')
    setActiveModal('reportSent')
    if (flash) flash(`Problem report ${newTicket.ticketNo} submitted to Office Staff.`)
  }

  return (
    <div className="cp-viewport">
      {/* Smartphone App Shell (Header starts cleanly, no status bar) */}
      <div className="cp-phone-frame">
        
        {/* Profile / App Header */}
        <header className="cp-header">
          <div className="cp-profile-box">
            <div className="cp-avatar-ring">
              {activeConsumer.avatar || activeConsumer.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="cp-profile-info">
              <span className="cp-greeting">
                Hello, <strong className="cp-user-name">{activeConsumer.name.split(' ')[0]}!</strong> 👋
              </span>
              <div className="cp-account-line">
                <span>Account No : {activeConsumer.accountNo}</span>
                <button
                  className="cp-btn-copy"
                  onClick={handleCopyAccount}
                  title="Copy Account Number"
                >
                  {copiedAccount ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          <div className="cp-header-actions">
            <button
              className="cp-btn-icon"
              onClick={() => setActiveModal('notice')}
              title="District Notifications"
            >
              <Bell size={18} />
              <span className="cp-bell-dot" />
            </button>
            <button
              className="cp-btn-icon"
              onClick={() => setShowSignOutConfirm(true)}
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main Scrollable Body */}
        <main className="cp-body">
          
          {/* TAB: HOME VIEW */}
          {activeTab === 'home' && (
            <>
              {/* Vibrant Gradient Card (Current Water Statement) */}
              <div className="cp-balance-card">
                <div className="cp-card-circles" />
                
                <div className="cp-balance-top">
                  <span className="cp-balance-label">
                    Current Water Statement
                    <button
                      className="cp-btn-eye"
                      onClick={() => setHideBalance(!hideBalance)}
                      title="Toggle Amount Privacy"
                    >
                      {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </span>
                  <button
                    className="cp-balance-history-btn"
                    onClick={() => setActiveTab('bills')}
                  >
                    <span>Details</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                <div className="cp-amount-wrap">
                  <span className="cp-currency-sign">₱</span>
                  <span className="cp-balance-amount">
                    {hideBalance
                      ? '••••••'
                      : (unpaidBill ? unpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00')}
                  </span>
                </div>

                <div className="cp-card-actions-row">
                  <button
                    className="cp-btn-topup"
                    onClick={() => setActiveModal('pay')}
                    disabled={!unpaidBill && !paymongoCheckout}
                  >
                    <CreditCard size={15} /> {paymongoCheckout && !unpaidBill ? 'Resume Checkout' : 'Pay Statement'}
                  </button>

                  <div className="cp-badge-due">
                    <Droplets size={14} />
                    <span>
                      {hasCurrentStatement ? `${latestBill.consumption ?? 0} m³ · ${activeConsumer.zone}` : 'No statement yet · 0 m³'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Action Grid (8 Colorful Action Buttons) */}
              <section className="cp-action-grid">
                <button className="cp-action-btn" onClick={() => setActiveModal('pay')} disabled={!unpaidBill && !paymongoCheckout}>
                  <div className="cp-icon-circle bg-soft-blue"><CreditCard size={22} strokeWidth={2.2} /></div>
                  <span className="cp-action-label">{paymongoCheckout && !unpaidBill ? 'Resume Checkout' : 'Pay Bill'}</span>
                </button>

                <button className="cp-action-btn" onClick={() => setActiveTab('bills')}>
                  <div className="cp-icon-circle bg-soft-cyan"><FileText size={22} strokeWidth={2.2} /></div>
                  <span className="cp-action-label">Statement</span>
                </button>

                <button className="cp-action-btn" onClick={() => setActiveTab('history')}>
                  <div className="cp-icon-circle bg-soft-orange"><Receipt size={22} strokeWidth={2.2} /></div>
                  <span className="cp-action-label">Receipts</span>
                </button>

                <button className="cp-action-btn" onClick={() => setActiveTab('usage')}>
                  <div className="cp-icon-circle bg-soft-emerald"><BarChart3 size={22} strokeWidth={2.2} /></div>
                  <span className="cp-action-label">Usage</span>
                </button>

                <button className="cp-action-btn" onClick={() => setActiveModal('meter')}>
                  <div className="cp-icon-circle bg-soft-amber"><Droplets size={22} strokeWidth={2.2} /></div>
                  <span className="cp-action-label">Cubic Meter</span>
                </button>

                <button className="cp-action-btn" onClick={() => setActiveModal('ticket')}>
                  <div className="cp-icon-circle bg-soft-purple"><Wrench size={22} strokeWidth={2.2} /></div>
                  <span className="cp-action-label">Report Problem</span>
                </button>

                <button className="cp-action-btn" onClick={() => setActiveModal('dossier')}>
                  <div className="cp-icon-circle bg-soft-slate"><User size={22} strokeWidth={2.2} /></div>
                  <span className="cp-action-label">Profile</span>
                </button>

                <button className="cp-action-btn" onClick={() => setActiveModal('notice')}>
                  <div className="cp-icon-circle bg-soft-rose"><Bell size={22} strokeWidth={2.2} /></div>
                  <span className="cp-action-label">Alerts</span>
                </button>
              </section>

              {/* Action Banner Card (Water Supply & Meter Health) */}
              <section className="cp-notice-card">
                <div className="cp-notice-main">
                  <div className="cp-notice-icon-circle">
                    <span>🚰</span>
                  </div>
                  <div className="cp-notice-text">
                    <h4 className="cp-notice-title">Water Service & Connection Health</h4>
                    <p className="cp-notice-desc">
                      District supply across <strong>{activeConsumer.zone}</strong> is optimal (48 PSI). Meter <strong>{activeConsumer.meterNo}</strong> is active and verified by field staff.
                    </p>
                  </div>
                </div>
                <button
                  className="cp-notice-btn"
                  onClick={() => setActiveModal('meter')}
                >
                    Inspect Digital Cubic Meter →
                </button>
              </section>

              {/* Field Service Ticket Tracker (Direct Alignment with Field Staff) */}
              {myComplaints.length > 0 && (
                <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                      👷 Active Field Work Order
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      myComplaints[0].status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {myComplaints[0].status}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600 bg-slate-50 p-3 rounded-xl">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Ticket No:</span>
                      <strong className="text-slate-800 font-mono">{myComplaints[0].ticketNo || myComplaints[0].id}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Issue:</span>
                      <span className="font-medium text-slate-800">{myComplaints[0].issueType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Technician:</span>
                      <strong className="text-sky-700 font-semibold">{myComplaints[0].assignedTech || myComplaints[0].assignedTo || 'Roberto Ramos'}</strong>
                    </div>
                    {myComplaints[0].notes && (
                      <div className="pt-1.5 border-t border-slate-200 text-[11px] text-slate-500 italic">
                        "{myComplaints[0].notes || myComplaints[0].resolution}"
                      </div>
                    )}
                    {myComplaints[0].resolutionImage && myComplaints[0].status === 'Resolved' && (
                      <div className="pt-2 border-t border-slate-200">
                        <p style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>📷 Repair Photo</p>
                        <img
                          src={myComplaints[0].resolutionImage}
                          alt="Repair documentation"
                          style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Recent Activity Feed */}
              <section className="cp-history-card">
                <div className="cp-history-header">
                  <h3 className="cp-history-title">Recent Activity</h3>
                  <span className="cp-history-badge">Live Ledger</span>
                </div>

                <div className="cp-tx-list">
                  {/* Latest Payment */}
                  {myPayments.length > 0 ? (
                    myPayments.slice(0, 2).map((p) => (
                      <div
                        key={p.id}
                        className="cp-tx-item"
                        onClick={() => {
                          setSelectedReceipt(p)
                          setActiveModal('receipt')
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="cp-tx-left">
                          <div className="cp-tx-icon-circle tx-out">↑</div>
                          <div className="cp-tx-details">
                            <span className="cp-tx-name">Water Bill Settlement</span>
                            <span className="cp-tx-time">
                              {p.date ? p.date.split(' ')[0] : '2026-09-02'} · {p.method}
                            </span>
                          </div>
                        </div>
                        <div className="cp-tx-right">
                          <span className="cp-tx-amount neg">
                            -₱ {Number(p.amountPaid).toFixed(2)}
                          </span>
                          <span className="cp-tx-status">Paid (OR)</span>
                        </div>
                      </div>
                    ))
                  ) : !isNewConsumer ? (
                    <div className="cp-tx-item">
                      <div className="cp-tx-left">
                        <div className="cp-tx-icon-circle tx-out"><ArrowUpRight size={14} /></div>
                        <div className="cp-tx-details">
                          <span className="cp-tx-name">Counter POS Payment</span>
                          <span className="cp-tx-time">02 Sep 2026 14:28 · Cash</span>
                        </div>
                      </div>
                      <div className="cp-tx-right">
                        <span className="cp-tx-amount neg">-₱ 744.40</span>
                        <span className="cp-tx-status">Paid</span>
                      </div>
                    </div>
                  ) : null}

                  {/* Meter Reading Run */}
                  {!isNewConsumer && (
                  <div className="cp-tx-item">
                    <div className="cp-tx-left">
                      <div className="cp-tx-icon-circle tx-in"><Droplets size={14} /></div>
                      <div className="cp-tx-details">
                        <span className="cp-tx-name">Field Verified Reading</span>
                        <span className="cp-tx-time">31 Aug 2026 · Field Tech Team</span>
                      </div>
                    </div>
                    <div className="cp-tx-right">
                      <span className="cp-tx-amount neutral">
                        {activeConsumer.lastReading || 148} m³
                      </span>
                      <span className="cp-tx-status">Verified Dial</span>
                    </div>
                  </div>
                  )}

                  {/* Complaint / Ticket */}
                  {myComplaints.length > 0 && (
                    <div className="cp-tx-item">
                      <div className="cp-tx-left">
                        <div className="cp-tx-icon-circle tx-service"><Wrench size={14} /></div>
                        <div className="cp-tx-details">
                          <span className="cp-tx-name">{myComplaints[0].issueType}</span>
                          <span className="cp-tx-time">{myComplaints[0].reportedAt || '03 Sep 2026'}</span>
                        </div>
                      </div>
                      <div className="cp-tx-right">
                        <span className="cp-tx-amount neutral" style={{ fontSize: '11px' }}>
                          {myComplaints[0].status}
                        </span>
                        <span className="cp-tx-status">{myComplaints[0].ticketNo || myComplaints[0].id}</span>
                      </div>
                    </div>
                  )}
                  {isNewConsumer && myPayments.length === 0 && myComplaints.length === 0 && (
                    <div className="cp-tx-item">
                      <div className="cp-tx-left">
                        <div className="cp-tx-icon-circle tx-in">💧</div>
                        <div className="cp-tx-details">
                          <span className="cp-tx-name">No recent activity</span>
                          <span className="cp-tx-time">Activity will appear after your first billing cycle.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  className="cp-btn-view-all"
                  onClick={() => setActiveTab('history')}
                >
                  View All Activity ›
                </button>
              </section>
            </>
          )}

          {/* TAB: STATEMENTS / BILLS */}
          {activeTab === 'bills' && (
            <div className="space-y-4">
              {unpaidBill ? (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <h3 className="font-bold text-slate-800 text-sm">Active Statement</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${unpaidBill ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {unpaidBill && unpaidAmount < Number(unpaidBill.totalAmount)
                      ? 'Partially Paid'
                      : unpaidBill ? 'Payment Due' : 'Fully Settled'}
                  </span>
                </div>

                <div className="my-4 text-center">
                  <span className="text-xs text-slate-400 font-medium block">Total Payable</span>
                  <strong className="text-3xl font-extrabold text-slate-900 block mt-1">
                    ₱ {Number(unpaidBill ? unpaidAmount : latestBill.totalAmount).toFixed(2)}
                  </strong>
                  {unpaidBill && unpaidAmount < Number(unpaidBill.totalAmount) && (
                    <span className="text-xs text-slate-500 block mt-1">
                      ₱{Number(unpaidBill.totalAmount).toFixed(2)} bill · ₱{(Number(unpaidBill.totalAmount) - unpaidAmount).toFixed(2)} paid
                    </span>
                  )}
                  <span className="text-xs text-slate-500 mt-1 block">
                    Due Date: <strong>{latestBill.dueDate || 'Calculated at month-end'}</strong>
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2 text-slate-600">
                  <div className="flex justify-between">
                    <span>Commodity Water Charge ({latestBill.consumption ?? 0} m³)</span>
                    <strong className="text-slate-800">₱ {Number(latestBill.baseAmount ?? 0).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Environmental Surcharge (10%)</span>
                    <strong className="text-slate-800">₱ {Number(latestBill.envFee ?? 0).toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Meter Maintenance Fee</span>
                    <strong className="text-slate-800">₱ {Number(latestBill.maintFee ?? 0).toFixed(2)}</strong>
                  </div>
                  {Number(latestBill.arrears || 0) > 0 && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Past Arrears</span>
                      <span>₱ {Number(latestBill.arrears).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(latestBill.penalty || 0) > 0 && (
                    <div className="flex justify-between text-amber-600 font-semibold">
                      <span>Late Penalty (10%)</span>
                      <span>₱ {Number(latestBill.penalty).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {hasArrearsOrPenalty && unpaidBill && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Over-The-Counter Payment Notice</strong>
                      <span>This bill includes arrears or penalties. Online GCash settlement is unavailable; please settle over the counter at the cashier.</span>
                    </div>
                  </div>
                )}

                <button
                  className="cp-btn-primary w-full mt-4"
                  onClick={() => setActiveModal('pay')}
                  disabled={!unpaidBill && !paymongoCheckout}
                >
                  {unpaidBill
                    ? (hasArrearsOrPenalty ? 'View Settlement Notice (Over the Counter) →' : 'Proceed to GCash Payment →')
                    : paymongoCheckout
                    ? 'Resume PayMongo Checkout →'
                    : 'No Payment Due Yet'}
                </button>
                </div>
              ) : (
                <div
                  role="status"
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center"
                >
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Check size={22} aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">No water statement due</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Your previous statement is settled. A new statement will appear here when it is issued, and you can pay it from this page.
                  </p>
                </div>
              )}

              {/* Statement History */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <h4 className="font-bold text-xs text-slate-700 mb-3 uppercase tracking-wider">Statement Ledger</h4>
                <div className="space-y-2">
                  {myBills.map((b) => (
                    <div key={b.id} className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 text-xs">
                      <div>
                        <strong className="text-slate-800 block">{b.id}</strong>
                        <span className="text-slate-400">{b.period || 'Cycle 2026'}</span>
                      </div>
                      <div className="text-right">
                        <strong className="text-slate-800 block">₱ {Number(b.totalAmount).toFixed(2)}</strong>
                        <span className={`text-[10px] font-bold ${b.status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {b.status === 'Paid'
                            ? 'Paid'
                            : getBillBalance(b) < Number(b.totalAmount)
                            ? `Partially paid · ₱${getBillBalance(b).toFixed(2)} due`
                            : b.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: USAGE / CONSUMPTION */}
          {activeTab === 'usage' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm mb-1">Monthly Consumption Analytics</h3>
                <p className="text-xs text-slate-400 mb-4">Household water consumption volume in cubic meters (m³)</p>

                {/* Visual Bar Chart */}
                <div className="flex items-end justify-between h-40 pt-6 pb-2 px-2 border-b border-slate-100">
                  {[
                    { month: 'Apr', val: 18 },
                    { month: 'May', val: 21 },
                    { month: 'Jun', val: 19 },
                    { month: 'Jul', val: 22 },
                    { month: 'Aug', val: 24 },
                    { month: 'Sep', val: 15 },
                  ].map((d, i) => (
                    <div key={d.month} className="flex flex-col items-center gap-1.5 flex-1">
                      <span className="text-[10px] font-bold text-slate-600">{d.val}m³</span>
                      <div
                        className={`w-7 rounded-t-lg transition-all ${
                          i === 4 ? 'bg-sky-500 shadow-md shadow-sky-200' : 'bg-slate-200'
                        }`}
                        style={{ height: `${d.val * 4.5}px` }}
                      />
                      <span className="text-[11px] font-semibold text-slate-500 mt-1">{d.month}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <div className="bg-sky-50 p-3 rounded-xl">
                    <span className="text-sky-600 font-medium block text-[11px]">6-Month Average</span>
                    <strong className="text-sky-900 text-base">19.8 m³ / mo</strong>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl">
                    <span className="text-emerald-600 font-medium block text-[11px]">Efficiency State</span>
                    <strong className="text-emerald-900 text-base">Optimal (Normal)</strong>
                  </div>
                </div>
              </div>

              {/* Water Conservation */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <h4 className="font-bold text-xs text-slate-700 mb-2">💡 Conservation Advisory</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Field staff recommends periodically checking toilet flappers and garden shutoff valves. A minor leak of 1 drop per second can waste over 2,000 liters of water each month.
                </p>
              </div>
            </div>
          )}

          {/* TAB: HISTORY ARCHIVE */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-800 text-sm">Official Transaction History</h3>
                  <button
                    className="text-xs text-sky-600 font-semibold"
                    onClick={() => setActiveTab('home')}
                  >
                    Back to Home
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {myPayments.map((p) => (
                    <div
                      key={p.id}
                      className="py-3 flex justify-between items-center cursor-pointer hover:bg-slate-50/50 rounded-lg px-1 transition"
                      onClick={() => {
                        setSelectedReceipt(p)
                        setActiveModal('receipt')
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold text-xs">✓ Official Receipt</span>
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.orNumber}</span>
                        </div>
                        <span className="text-xs text-slate-500 mt-0.5 block">{p.date || '02 Sep 2026'} · {p.method}</span>
                      </div>
                      <div className="text-right">
                        <strong className="text-sm font-bold text-slate-800 block">-₱ {Number(p.amountPaid).toFixed(2)}</strong>
                        <span className="text-[10px] text-sky-600">View official receipt</span>
                      </div>
                    </div>
                  ))}

                  {myBills.map((b) => (
                    <div key={b.id} className="py-3 flex justify-between items-center">
                      <div>
                        <span className="text-slate-800 font-semibold text-xs block">Invoice {b.id}</span>
                        <span className="text-[11px] text-slate-400">{b.period} · {b.consumption} m³</span>
                      </div>
                      <div className="text-right">
                        <strong className="text-xs font-bold text-slate-800 block">₱ {Number(b.totalAmount).toFixed(2)}</strong>
                        <span className={`text-[10px] font-bold ${b.status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {b.status === 'Paid'
                            ? 'Paid'
                            : getBillBalance(b) < Number(b.totalAmount)
                            ? `Partially paid · ₱${getBillBalance(b).toFixed(2)} due`
                            : 'Unpaid'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ACCOUNT PROFILE */}
          {activeTab === 'account' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-400 text-white font-bold text-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-sky-200">
                  {activeConsumer.avatar || 'AO'}
                </div>
                <h3 className="font-extrabold text-base text-slate-800">{activeConsumer.name}</h3>
                <span className="text-xs text-slate-400 block mt-0.5">{activeConsumer.accountNo} · Sector {activeConsumer.zone}</span>

                <div className="mt-4 pt-4 border-t border-slate-100 text-left space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delivery Address</span>
                    <span className="font-medium text-slate-800 text-right max-w-[180px]">{activeConsumer.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mobile Contact</span>
                    <span className="font-medium text-slate-800">{activeConsumer.contact}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Meter Serial Number</span>
                    <span className="font-mono font-bold text-sky-600">{activeConsumer.meterNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Commission Date</span>
                    <span className="font-medium text-slate-800">{activeConsumer.connectionDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Classification</span>
                    <span className="font-medium text-slate-800">{activeConsumer.classification}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latest Verified Reading</span>
                    <strong className="text-slate-900 font-mono">{activeConsumer.lastReading || 148} m³</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="w-full mt-4 py-2.5 bg-sky-50 text-sky-700 rounded-xl font-bold text-xs hover:bg-sky-100 transition flex items-center justify-center gap-1.5 border border-sky-100"
                  onClick={() => setActiveModal('dossier')}
                >
                  <span>✏️</span> Edit Profile & Contact Number
                </button>

                <button
                  className="w-full mt-2.5 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-bold text-xs hover:bg-rose-100 transition"
                  onClick={() => setShowSignOutConfirm(true)}
                >
                  Sign Out of Consumer Portal
                </button>
              </div>
            </div>
          )}

        </main>

        {/* Floating Bottom Navigation Bar (Dock) */}
        <nav className="cp-bottom-nav">
          <button
            className={`cp-nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span className="cp-nav-icon"><Home size={20} strokeWidth={activeTab === 'home' ? 2.5 : 2} /></span>
            <span>Home</span>
          </button>

          <button
            className={`cp-nav-item ${activeTab === 'bills' ? 'active' : ''}`}
            onClick={() => setActiveTab('bills')}
          >
            <span className="cp-nav-icon"><FileText size={20} strokeWidth={activeTab === 'bills' ? 2.5 : 2} /></span>
            <span>Bills</span>
          </button>

          {/* Central Raised Floating Button for Quick Pay */}
          <button
            className="cp-nav-center-btn"
            onClick={() => setActiveModal('pay')}
            title="Instant Settlement"
          >
            <Droplets size={22} strokeWidth={2.5} />
          </button>

          <button
            className={`cp-nav-item ${activeTab === 'usage' ? 'active' : ''}`}
            onClick={() => setActiveTab('usage')}
          >
            <span className="cp-nav-icon"><BarChart3 size={20} strokeWidth={activeTab === 'usage' ? 2.5 : 2} /></span>
            <span>Analytics</span>
          </button>

          <button
            className="cp-nav-item"
            onClick={() => setActiveModal('dossier')}
          >
            <span className="cp-nav-icon"><User size={20} strokeWidth={2} /></span>
            <span>Profile</span>
          </button>
        </nav>

        {/* ─── MODAL: PROFILE & ACCOUNT SETTINGS ─── */}
        {activeModal === 'dossier' && (
          <div className="cp-modal-backdrop cp-modal-centered" onClick={() => setActiveModal(null)}>
            <div className="cp-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="cp-sheet-handle" />
              <div className="cp-sheet-header">
                <h3 className="cp-sheet-title">Profile & Account</h3>
                <button className="cp-sheet-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-400 text-white font-bold text-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-sky-200">
                  {activeConsumer.avatar || 'AO'}
                </div>
                <h4 className="font-extrabold text-base text-slate-800">{activeConsumer.name}</h4>
                <span className="text-xs text-slate-400">{activeConsumer.accountNo}</span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2 text-slate-600">
                <div className="flex justify-between gap-4">
                  <span>Service Address</span>
                  <strong className="text-slate-800 text-right">{activeConsumer.address}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Mobile Contact</span>
                  <strong className="text-slate-800">{activeConsumer.contact}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Meter Number</span>
                  <strong className="text-sky-700">{activeConsumer.meterNo}</strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Classification</span>
                  <strong className="text-slate-800">{activeConsumer.classification}</strong>
                </div>
              </div>

              <div className="cp-profile-location-card">
                <div className="cp-profile-location-header">
                  <div>
                    <span className="cp-profile-location-label">Registered Map Location</span>
                    <strong>{profileCoordinates ? 'President-approved service pin' : 'Location unavailable'}</strong>
                  </div>
                  <span className="cp-profile-location-icon">📍</span>
                </div>
                {profileCoordinates ? (
                  <>
                    <div ref={profileMapRef} className="cp-profile-location-map" />
                    <small>{profileCoordinates.lat.toFixed(6)}, {profileCoordinates.lng.toFixed(6)}</small>
                  </>
                ) : (
                  <div className="cp-profile-location-empty">No registered map pin is available yet.</div>
                )}
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-3">
                <div className="cp-input-group">
                  <label className="cp-input-label" htmlFor="profile-email">Gmail / Email Account</label>
                  <input
                    id="profile-email"
                    className="cp-input"
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                    placeholder="you@gmail.com"
                    required
                  />
                </div>
                <div className="cp-input-group">
                  <label className="cp-input-label" htmlFor="profile-contact">Mobile Contact / GCash Number</label>
                  <input
                    id="profile-contact"
                    className="cp-input"
                    type="tel"
                    value={profileContact}
                    onChange={(event) => setProfileContact(event.target.value)}
                    placeholder="0912 345 6789"
                  />
                  <small style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Used for PayMongo / GCash receipt & billing communications
                  </small>
                </div>
                <div className="cp-input-group">
                  <label className="cp-input-label" htmlFor="profile-password">New Password</label>
                  <input
                    id="profile-password"
                    className="cp-input"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Leave blank to keep current password"
                    minLength={8}
                  />
                </div>
                <div className="cp-input-group">
                  <label className="cp-input-label" htmlFor="profile-password-confirm">Confirm New Password</label>
                  <input
                    id="profile-password-confirm"
                    className="cp-input"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(event) => setConfirmNewPassword(event.target.value)}
                    placeholder="Repeat new password"
                  />
                </div>
                <button type="submit" className="cp-btn-primary w-full">
                  Save Profile Changes
                </button>
              </form>

              <button className="w-full py-2.5 bg-rose-50 text-rose-600 rounded-xl font-bold text-xs hover:bg-rose-100 transition" onClick={() => setShowSignOutConfirm(true)}>
                Sign Out of Consumer Portal
              </button>
            </div>
          </div>
        )}

        {/* ─── MODAL: PAYMENT SHEET ─── */}
        {activeModal === 'pay' && createPortal(
          <div className="cp-modal-backdrop cp-modal-centered cp-payment-modal" onClick={() => setActiveModal(null)}>
            <div className="cp-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="cp-sheet-handle" />
              <div className="cp-sheet-header">
                <h3 className="cp-sheet-title" style={{ fontSize: '1.7rem', lineHeight: '0.9', letterSpacing: '-0.06em', whiteSpace: 'nowrap' }}>
                  Settle Water Statement Online
                </h3>
                <button className="cp-sheet-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>

              <div className="bg-sky-50 rounded-2xl p-4 text-center border border-sky-100">
                <span className="text-xs text-sky-700 block font-medium">Payable Amount</span>
                <strong className="text-3xl font-extrabold text-sky-950 block mt-1">
                  ₱ {Number(paymongoCheckout?.amount ?? (unpaidBill ? unpaidAmount : 0)).toFixed(2)}
                </strong>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {activeConsumer.name} · {activeConsumer.accountNo}
                </span>
              </div>

              {isBelowPaymongoMinimum && !hasArrearsOrPenalty && (
                <div
                  role="status"
                  style={{
                    background: '#fffbeb',
                    border: '1.5px solid #f59e0b',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    color: '#92400e',
                    fontSize: '12px',
                    lineHeight: 1.5,
                  }}
                >
                  PayMongo checkout requires at least ₱20.00. Your remaining balance is ₱{Number(unpaidAmount).toFixed(2)}; please pay this exact amount at the cashier.
                </div>
              )}

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block">Digital Payment Channel</span>

                {hasArrearsOrPenalty ? (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      background: '#fffbeb',
                      border: '1.5px solid #f59e0b',
                      borderRadius: '16px',
                      padding: '14px 16px',
                      marginBottom: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309' }}>
                      <AlertCircle size={20} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                      <strong style={{ fontSize: '13px', fontWeight: 800 }}>
                        Over-The-Counter Settlement Required
                      </strong>
                    </div>
                    <p style={{ fontSize: '12px', color: '#92400e', margin: 0, lineHeight: '1.4' }}>
                      This account has <strong>{Number(latestBill.arrears || 0) > 0 ? `arrears (₱ ${Number(latestBill.arrears).toFixed(2)})` : ''}{Number(latestBill.arrears || 0) > 0 && Number(latestBill.penalty || 0) > 0 ? ' & ' : ''}{Number(latestBill.penalty || 0) > 0 ? `penalties (₱ ${Number(latestBill.penalty).toFixed(2)})` : (latestBill.status === 'Overdue' && Number(latestBill.arrears || 0) <= 0 ? 'overdue status' : '')}</strong>. Online GCash settlement is unavailable for overdue accounts.
                    </p>
                    <div style={{ fontSize: '11px', color: '#78350f', background: 'rgba(245, 158, 11, 0.15)', padding: '6px 10px', borderRadius: '8px' }}>
                      🏢 Please visit the <strong>Lambawasa Municipal Water Office (Cashier Counter 1-3)</strong> to settle your balance in person.
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* PayMongo Unified Gateway Option */}
                  <div
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '18px',
                      background: hasArrearsOrPenalty ? '#f1f5f9' : '#f0f9ff',
                      border: hasArrearsOrPenalty ? '1.5px dashed #cbd5e1' : '2px solid #0284c7',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: '0 2px 10px rgba(2, 132, 199, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>⚡</span>
                        <div>
                          <strong style={{ fontSize: '15px', color: '#0369a1', display: 'block' }}>
                            PayMongo Payment Gateway
                          </strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            Official BSP-regulated secure checkout
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, background: '#e0f2fe', color: '#0284c7', padding: '3px 8px', borderRadius: '12px' }}>
                        {paymongoConfig === null
                          ? 'Checking…'
                          : paymongoConfig.configured
                          ? paymongoConfig.mode === 'test' ? 'Test Mode' : 'Live Mode'
                          : 'Unavailable'}
                      </span>
                    </div>

                    {paymongoConfig && !paymongoConfig.configured && (
                      <p role="alert" style={{ margin: 0, fontSize: '12px', color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '10px' }}>
                        Online checkout is temporarily unavailable. {paymongoConfig.error || 'The server needs a PayMongo key configured.'} Your statement remains unpaid; please try again later or pay at the cashier.
                      </p>
                    )}
                    {paymongoConfig?.configured && paymongoConfig.mode === 'test' && (
                      <p role="status" style={{ margin: 0, fontSize: '12px', color: '#854d0e', background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px' }}>
                        Test mode only: transactions are simulated and do not move real money or create payouts.
                      </p>
                    )}

                    {/* Supported channels tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', background: '#005ce6', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        GCash
                      </span>
                      <span style={{ fontSize: '11px', background: '#10b981', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        Maya
                      </span>
                      <span style={{ fontSize: '11px', background: '#059669', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        GrabPay
                      </span>
                      <span style={{ fontSize: '11px', background: '#3b82f6', color: '#fff', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                        Visa / Mastercard
                      </span>
                    </div>

                    {/* Contact Number Input for GCash / PayMongo */}
                    <div style={{ marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                      <label
                        htmlFor="pay-contact-input"
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0369a1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <span>📱 GCash / Mobile Contact Number</span>
                        <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>Editable</span>
                      </label>
                      <input
                        id="pay-contact-input"
                        type="tel"
                        value={payContact}
                        onChange={(e) => setPayContact(e.target.value)}
                        placeholder="e.g. 0917 123 4567"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          border: '1.5px solid #bae6fd',
                          background: '#ffffff',
                          fontSize: '13px',
                          color: '#0f172a',
                          fontWeight: 600,
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <small style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px', display: 'block' }}>
                        This contact number will be attached to your GCash / PayMongo checkout receipt.
                      </small>
                    </div>
                  </div>

                  {/* If checkout session is active */}
                  {paymongoCheckoutUrl && (
                    <div
                      role="status"
                      aria-live="polite"
                      style={{
                        background: '#ecfdf5',
                        border: '1.5px solid #10b981',
                        borderRadius: '16px',
                        padding: '14px',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: '#065f46', fontWeight: 700, display: 'block' }}>
                        PayMongo Checkout Session Ready
                      </span>
                      <span style={{ fontSize: '11px', color: '#047857', display: 'block', marginTop: '3px' }}>
                        Bill {paymongoCheckout.billId} · ₱{Number(paymongoCheckout.amount).toFixed(2)}
                      </span>
                      {paymongoVerificationMessage && (
                        <p role="status" aria-live="polite" style={{ fontSize: '12px', color: '#065f46', margin: '8px 0' }}>
                          {paymongoVerificationMessage}
                        </p>
                      )}
                      <p style={{ fontSize: '11px', color: '#047857', margin: '4px 0 10px' }}>
                        Tap below if the checkout tab didn't open automatically, then click <strong>Verify & Complete</strong> once paid.
                      </p>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <a
                          href={paymongoCheckoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cp-btn-primary"
                          style={{
                            fontSize: '12px',
                            padding: '8px 14px',
                            background: '#0284c7',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          Open Checkout Page ↗
                        </a>
                        <button
                          type="button"
                          onClick={handleVerifyAndFinalizePayment}
                          aria-busy={isPaying}
                          className="cp-btn-primary"
                          style={{
                            fontSize: '12px',
                            padding: '8px 14px',
                            background: '#10b981',
                          }}
                        >
                          {isPaying ? 'Verifying...' : '✓ Verify & Complete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!paymongoCheckoutUrl ? (
                <button
                  className="cp-btn-primary mt-2"
                  onClick={handlePaySubmit}
                  disabled={isPaying || !unpaidBill || hasArrearsOrPenalty || isBelowPaymongoMinimum || !paymongoConfig?.configured}
                  style={{
                    background: hasArrearsOrPenalty || isBelowPaymongoMinimum || !paymongoConfig?.configured ? '#94a3b8' : undefined,
                    cursor: hasArrearsOrPenalty || isBelowPaymongoMinimum || !paymongoConfig?.configured ? 'not-allowed' : undefined,
                  }}
                >
                  {hasArrearsOrPenalty
                    ? 'Must Settle Over The Counter (Cashier)'
                    : isBelowPaymongoMinimum
                    ? 'Pay Exact Amount at the Cashier'
                    : paymongoConfig && !paymongoConfig.configured
                    ? 'Online Payment Unavailable'
                    : paymongoConfig === null
                    ? 'Checking PayMongo Gateway...'
                    : isPaying
                    ? 'Initializing PayMongo Gateway...'
                    : unpaidBill
                    ? `Proceed to Pay ₱ ${Number(unpaidAmount).toFixed(2)} via PayMongo`
                    : 'No payable statement available'}
                </button>
              ) : (
                <button
                  type="button"
                  className="cp-btn-primary mt-2"
                  onClick={handleVerifyAndFinalizePayment}
                  aria-busy={isPaying}
                  style={{ background: '#10b981' }}
                >
                  {isPaying ? 'Verifying PayMongo Payment...' : '✓ Confirm & Generate Official Receipt'}
                </button>
              )}
            </div>
          </div>,
          document.body
        )}

        {/* ─── MODAL: OFFICIAL RECEIPT ─── */}
        {activeModal === 'receipt' && (
          <div className="cp-modal-backdrop" onClick={() => setActiveModal(null)}>
            <div className="cp-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="cp-sheet-handle" />
              <div className="cp-sheet-header">
                <h3 className="cp-sheet-title">Official Payment Receipt</h3>
                <button className="cp-sheet-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50 text-xs space-y-3 font-mono">
                <div className="text-center pb-2 border-b border-slate-200">
                  <strong className="text-slate-800 text-sm block">LAMBAWASA UTILITY DISTRICT</strong>
                  <span className="text-slate-500 text-[10px]">Official Serialized E-Receipt (P.O.S.)</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt No (OR):</span>
                  <strong className="text-slate-800">{selectedReceipt?.orNumber || 'OR-2026-9042'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Account Name:</span>
                  <strong className="text-slate-800">{activeConsumer.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Account No:</span>
                  <span className="text-slate-800">{activeConsumer.accountNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Channel:</span>
                  <span className="text-slate-800">{selectedReceipt?.method || payMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Previous Consumption:</span>
                  <span className="text-slate-800">{receiptPreviousReading.toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Meter Reading:</span>
                  <span className="text-slate-800">{receiptPresentReading.toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Usage Summary:</span>
                  <strong className="text-sky-700">{receiptConsumption.toFixed(2)} m³ consumed</strong>
                </div>
                {receiptPenalty > 0 && (
                  <div className="flex justify-between font-bold">
                    <span className="text-red-600">Penalty:</span>
                    <span className="text-red-600">₱ {receiptPenalty.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-sm">
                  <span className="text-slate-800">Amount Settled:</span>
                  <span className="text-emerald-600">₱ {selectedReceipt ? Number(selectedReceipt.amountPaid).toFixed(2) : '1,473.70'}</span>
                </div>
                <div className="text-center pt-2 text-[10px] text-slate-400">
                  Status: VERIFIED & COMMITTED TO MUNICIPAL LEDGER
                </div>
              </div>

              <button
                className="cp-btn-primary"
                onClick={() => {
                  window.print()
                }}
              >
                🖨️ Print / Save Official Receipt
              </button>
            </div>
          </div>
        )}

        {/* ─── MODAL: FILE COMPLAINT / REPORT PROBLEM ─── */}
        {activeModal === 'ticket' && (
          <div className="cp-modal-backdrop" onClick={() => setActiveModal(null)}>
            <div className="cp-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="cp-sheet-handle" />
              <div className="cp-sheet-header">
                <h3 className="cp-sheet-title">Report Issue to Field Crew</h3>
                <button className="cp-sheet-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>

              <form onSubmit={handleComplaintSubmit} className="space-y-3 text-xs">
                <div className="cp-input-group">
                  <label className="cp-input-label">Issue Category</label>
                  <select
                    className="cp-input"
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                  >
                    <option value="Low Water Pressure">Low Water Pressure (Sector Mainline)</option>
                    <option value="Pipe Leak Near Curb Stop">Pipe Leak Near Curb Stop</option>
                    <option value="Water Discoloration Check">Water Discoloration / Turbidity</option>
                    <option value="Meter Dial Fogging">Meter Glass Fogging / Damaged Dial</option>
                    <option value="Other">Other problem</option>
                  </select>
                </div>

                {issueType === 'Other' && (
                  <div className="cp-input-group">
                    <label className="cp-input-label" htmlFor="custom-problem-type">Describe the problem</label>
                    <input
                      id="custom-problem-type"
                      className="cp-input"
                      type="text"
                      placeholder="e.g. No water supply in the kitchen"
                      value={customIssueType}
                      onChange={(e) => setCustomIssueType(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="cp-input-group">
                  <label className="cp-input-label">Detailed Notes / Landmark Location</label>
                  <textarea
                    className="cp-input"
                    rows={3}
                    placeholder="Your registered service location will appear here..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                  <textarea
                    className="cp-input mt-2"
                    rows={2}
                    value={landmarkLocation}
                    onChange={(e) => setLandmarkLocation(e.target.value)}
                    placeholder="Registered consumer location"
                    aria-label="Consumer service location and landmarks"
                  />
                </div>

                <button type="submit" className="cp-btn-primary w-full mt-2">
                  Report Problem to Field Service →
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: REPORT SENT CONFIRMATION ─── */}
        {activeModal === 'reportSent' && submittedReport && (
          <div className="cp-modal-backdrop cp-modal-centered" onClick={() => setActiveModal(null)}>
            <div className="cp-modal-sheet cp-report-sent-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="cp-sheet-handle" />
              <div className="cp-sheet-header">
                <h3 className="cp-sheet-title">Report Sent</h3>
                <button className="cp-sheet-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>

              <div className="cp-report-sent-icon">✓</div>
              <h4 className="cp-report-sent-title">Your problem was reported</h4>
              <p className="cp-report-sent-copy">
                Your report was sent to Office Staff for review and forwarding to Field Staff.
              </p>
              <div className="cp-report-sent-summary">
                <div><span>Ticket Number</span><strong>{submittedReport.ticketNo}</strong></div>
                <div><span>Problem</span><strong>{submittedReport.issueType}</strong></div>
                <div><span>Status</span><strong>Reported - Office Staff Intake</strong></div>
              </div>
              <button className="cp-btn-primary w-full" onClick={() => setActiveModal(null)}>
                Done
              </button>
            </div>
          </div>
        )}

        {/* ─── MODAL: DIGITAL CUBIC METER ─── */}
        {activeModal === 'meter' && (
          <div className="cp-modal-backdrop cp-modal-centered" onClick={() => setActiveModal(null)}>
            <div className="cp-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="cp-sheet-handle" />
              <div className="cp-sheet-header">
                <h3 className="cp-sheet-title">Digital Cubic Meter</h3>
                <button className="cp-sheet-close" onClick={() => setActiveModal(null)}>✕</button>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-5 text-center shadow-lg relative overflow-hidden">
                <div className="w-24 h-24 rounded-full border-4 border-sky-400 flex flex-col items-center justify-center mx-auto my-2 bg-slate-800">
                  <span className="text-2xl font-black font-mono text-sky-300">
                    {activeConsumer.lastReading || 148}
                  </span>
                  <span className="text-[10px] text-slate-400">CUBIC METERS (m³)</span>
                </div>
                <strong className="text-sm font-bold block text-slate-200 mt-2">
                  {activeConsumer.meterNo}
                </strong>
                <span className="text-xs text-sky-400 block font-medium">
                  Aquaflow Pro Brass (1/2") · Tamper Sealed
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2 text-slate-600">
                <div className="flex justify-between">
                  <span>Calibration Status</span>
                  <strong className="text-emerald-600">Certified Compliant (+/- 0.3%)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Assigned Sector</span>
                  <span className="font-semibold text-slate-800">{activeConsumer.zone}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lead Technician</span>
                  <span className="text-slate-800">Roberto Ramos (Field Team Alpha)</span>
                </div>
                <div className="flex justify-between">
                  <span>Next Routine Calibration</span>
                  <span className="text-slate-800">March 2028</span>
                </div>
              </div>

              <button className="cp-btn-primary" onClick={() => setActiveModal(null)}>
                Close Cubic Meter Details
              </button>
            </div>
          </div>
        )}

        {/* ─── MODAL: NOTIFICATIONS / INFO ─── */}
        {activeModal === 'notice' && (
          <div className="cp-modal-backdrop cp-modal-centered" onClick={() => { setActiveModal(null); setSelectedNotification(null) }}>
            <div className="cp-modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="cp-sheet-handle" />

              {/* ── DETAIL VIEW ── */}
              {selectedNotification ? (() => {
                const isResolution = selectedNotification.type === 'Service Alert' || selectedNotification.message?.toLowerCase().includes('resolved')
                // Find related complaint by ticketId stored on the notification
                const relatedComplaint = selectedNotification.ticketId
                  ? complaints.find((c) => c.id === selectedNotification.ticketId)
                  : complaints.find(
                      (c) => c.status === 'Resolved' && (
                        c.consumerId === activeConsumer.id ||
                        c.accountNo === activeConsumer.accountNo
                      ) && selectedNotification.message?.includes(c.issueType)
                    )
                // Read image: dedicated localStorage map (cross-session) > notification > complaint in state
                const imageStore = (() => { try { return JSON.parse(localStorage.getItem('lambawasa_resolutionImages') || '{}') } catch { return {} } })()
                const resolvedImage =
                  imageStore[selectedNotification.ticketId] ||
                  selectedNotification.resolutionImage ||
                  relatedComplaint?.resolutionImage ||
                  null

                return (
                  <>
                    <div className="cp-sheet-header">
                      <button
                        className="cp-sheet-close"
                        style={{ fontSize: '13px', padding: '4px 8px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer', color: '#475569' }}
                        onClick={() => setSelectedNotification(null)}
                      >
                        ← Back
                      </button>
                      <button className="cp-sheet-close" onClick={() => { setActiveModal(null); setSelectedNotification(null) }}>✕</button>
                    </div>

                    <div style={{ padding: '4px 0 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '22px' }}>{isResolution ? '✅' : '🔔'}</span>
                        <div>
                          <strong style={{ display: 'block', fontSize: '14px', color: '#0f4c3a' }}>
                            {isResolution ? 'Problem Report Update' : (selectedNotification.type || 'Notification')}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{selectedNotification.sentAt}</span>
                        </div>
                      </div>

                      <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', background: '#f8fdfb', border: '1px solid #d1fae5', borderRadius: '10px', padding: '12px' }}>
                        {selectedNotification.message}
                      </p>

                      {resolvedImage && (
                        <div style={{ marginTop: '14px' }}>
                          <p style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                            📷 Field Repair Photo
                          </p>
                          <img
                            src={resolvedImage}
                            alt="Field repair documentation"
                            style={{ width: '100%', borderRadius: '10px', border: '1px solid #d1fae5', objectFit: 'cover', maxHeight: '240px' }}
                          />
                        </div>
                      )}

                      {isResolution && relatedComplaint && (
                        <div style={{ marginTop: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 12px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#64748b' }}>Ticket No:</span>
                            <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{relatedComplaint.ticketNo}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#64748b' }}>Issue:</span>
                            <span style={{ color: '#0f172a' }}>{relatedComplaint.issueType}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#64748b' }}>Technician:</span>
                            <strong style={{ color: '#0369a1' }}>{relatedComplaint.assignedTech || relatedComplaint.assignedTo}</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    <button className="cp-btn-primary" onClick={() => { setActiveModal(null); setSelectedNotification(null) }}>
                      Close
                    </button>
                  </>
                )
              })() : (
              /* ── LIST VIEW ── */
              <>
                <div className="cp-sheet-header">
                  <h3 className="cp-sheet-title">District Notices & Alerts</h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {myNotifications.length > 0 && (
                      <button
                        style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 9px', cursor: 'pointer' }}
                        onClick={() => {
                          if (onClearNotifications) onClearNotifications(activeConsumer.id, activeConsumer.accountNo)
                        }}
                      >
                        🗑 Clear All
                      </button>
                    )}
                    <button className="cp-sheet-close" onClick={() => setActiveModal(null)}>✕</button>
                  </div>
                </div>

                <div className="space-y-3">
                  {myNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs"
                      style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => setSelectedNotification(notification)}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#d1fae5'}
                      onMouseLeave={(e) => e.currentTarget.style.background = ''}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong className="text-emerald-900 block font-bold">✓ Problem Report Update</strong>
                        <span style={{ fontSize: '10px', color: '#6b9e94', marginLeft: '8px', whiteSpace: 'nowrap' }}>Tap to view →</span>
                      </div>
                      <p className="text-slate-600 mt-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {notification.message}
                      </p>
                      <span className="text-[10px] text-slate-400 mt-1 block">{notification.sentAt}</span>
                    </div>
                  ))}

                  <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-xs">
                    <strong className="text-sky-900 block font-bold">💧 Scheduled Sector Flushing</strong>
                    <p className="text-slate-600 mt-1">
                      Routine mainline flushing in {activeConsumer.zone} scheduled Sunday 23:00 - 02:00. Normal pressure maintained.
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">14 Sep 2026</span>
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
                    <strong className="text-emerald-900 block font-bold">✓ Verified Billing Statement</strong>
                    <p className="text-slate-600 mt-1">
                      August statement generated based on verified meter reading of {activeConsumer.lastReading || 148} m³.
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">01 Sep 2026</span>
                  </div>
                </div>

                <button className="cp-btn-primary" onClick={() => setActiveModal(null)}>
                  Close Notifications
                </button>
              </>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Sign Out Confirmation */}
      {showSignOutConfirm && (
        <div
          className="cp-modal-backdrop cp-modal-centered"
          onClick={() => setShowSignOutConfirm(false)}
          style={{ zIndex: 99999 }}
        >
          <div className="cp-modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '320px', textAlign: 'center' }}>
            <div className="cp-sheet-handle" />
            <h3 className="cp-sheet-title" style={{ marginBottom: '8px' }}>Sign Out?</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              You'll be returned to the login screen.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="cp-btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowSignOutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="cp-btn-primary"
                style={{ flex: 1, background: '#ef4444' }}
                onClick={() => { setShowSignOutConfirm(false); onSignOut() }}
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
