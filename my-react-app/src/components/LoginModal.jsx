import React, { useState, useEffect } from 'react'
import './LoginModal.css'
import { api } from '../services/api'
import {
  HardHat,
  Building2,
  Crown,
  Banknote,
  Droplet,
  IdCard,
  Lock,
  MapPin,
  ArrowRight,
  X,
  AlertTriangle,
  User,
} from 'lucide-react'

export default function LoginModal({
  isOpen,
  onClose,
  onLogin,
  onOpenRegister,
  flash,
  initialMode = 'consumer', // 'consumer' | 'field' | 'admin'
  registeredUsers = [],
  consumers = [],
  consumerOnly = false,
  consumerAndFieldOnly = false,
}) {
  const [authMode, setAuthMode] = useState(initialMode) // 'consumer' | 'field' | 'admin'
  const [staffRolePreset, setStaffRolePreset] = useState('office')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [fieldZone, setFieldZone] = useState('Mabuhay')
  const [error, setError] = useState('')

  // Sync mode whenever modal is opened with specific intent
  useEffect(() => {
    if (isOpen) {
      setAuthMode(initialMode)
      setStaffRolePreset(initialMode === 'consumer' ? 'consumer' : initialMode === 'field' ? 'field' : 'office')
      setIdentifier('')
      setPassword('')
      setError('')
    }
  }, [isOpen, initialMode])

  if (!isOpen) return null

  // Quick switch tab handlers
  const handleSwitchTab = (mode, preset = 'office') => {
    setAuthMode(mode)
    setStaffRolePreset(preset)
    setIdentifier('')
    setPassword('')
    setError('')
  }

  const isStaffEntry = !consumerOnly && initialMode === 'field'

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedId = identifier.trim()
    const trimmedPass = password.trim()

    if (!trimmedId || !trimmedPass) {
      setError('Please provide both username/account number and password.')
      return
    }

    // 1. CONSUMER / HOUSEHOLD LOGIN FLOW
    if (authMode === 'consumer') {
      // Check newly registered accounts
      const regMatch = registeredUsers.find(
        (u) =>
          u.accountNo?.toLowerCase() === trimmedId.toLowerCase() ||
          u.username?.toLowerCase() === trimmedId.toLowerCase() ||
          u.consumerId?.toLowerCase() === trimmedId.toLowerCase()
      )

      if (regMatch) {
        const consumerMatch = consumers.find(
          (consumer) =>
            (regMatch.consumerId && consumer.id === regMatch.consumerId) ||
            (regMatch.accountNo && consumer.accountNo === regMatch.accountNo) ||
            (regMatch.username && consumer.username?.toLowerCase() === regMatch.username.toLowerCase()) ||
            (regMatch.fullName && consumer.name?.toLowerCase() === regMatch.fullName.toLowerCase())
        )
        const approvalStatus = consumerMatch?.approvalStatus || regMatch.approvalStatus
        const accountStatus = consumerMatch?.status || regMatch.status

        if (approvalStatus === 'Pending' || accountStatus === 'Pending Approval' || accountStatus === 'Pending') {
          setError('This household account is awaiting President approval.')
          return
        }
        if (approvalStatus === 'Rejected' || accountStatus === 'Rejected') {
          setError('This household account was rejected. Please contact the utility office.')
          return
        }
        onLogin({
          username: regMatch.username,
          role: 'House Hold',
          fullName: regMatch.fullName,
          consumerId: regMatch.consumerId,
          accountNo: regMatch.accountNo,
          meterNo: regMatch.meterNo,
          zone: regMatch.zone,
          address: regMatch.address,
          avatar: regMatch.avatar || 'HC',
          isNewAccount: regMatch.isNewAccount ?? true,
        })
        if (flash) flash(`Welcome, ${regMatch.fullName}! Logged into Consumer Portal.`)
        onClose()
        return
      }

      let consumerMatch = consumers.find(
        (consumer) =>
          consumer.accountNo?.toLowerCase() === trimmedId.toLowerCase() ||
          consumer.username?.toLowerCase() === trimmedId.toLowerCase() ||
          consumer.id?.toLowerCase() === trimmedId.toLowerCase()
      )

      // Refresh from MySQL when the app opened before its initial sync completed.
      if (!consumerMatch) {
        const liveData = await api.fetchSystemData()
        consumerMatch = liveData?.consumers?.find(
          (consumer) =>
            consumer.accountNo?.toLowerCase() === trimmedId.toLowerCase() ||
            consumer.username?.toLowerCase() === trimmedId.toLowerCase() ||
            consumer.id?.toLowerCase() === trimmedId.toLowerCase()
        )
      }

      if (consumerMatch) {
        const approvalStatus = consumerMatch.approvalStatus || consumerMatch.status
        if (approvalStatus === 'Pending' || approvalStatus === 'Pending Approval') {
          setError('This household account is awaiting President approval.')
          return
        }
        if (approvalStatus === 'Rejected') {
          setError('This household account was rejected. Please contact the utility office.')
          return
        }

        onLogin({
          username: consumerMatch.username || trimmedId.toLowerCase(),
          role: 'House Hold',
          fullName: consumerMatch.name,
          consumerId: consumerMatch.id,
          accountNo: consumerMatch.accountNo,
          meterNo: consumerMatch.meterNo,
          zone: consumerMatch.zone,
          address: consumerMatch.address,
          avatar: consumerMatch.avatar || 'HC',
          isNewAccount: consumerMatch.isNewAccount ?? false,
        })
        if (flash) flash(`Welcome, ${consumerMatch.name}! Logged into Consumer Portal.`)
        onClose()
        return
      }

      const isDemoAccount = [
        'acc-88201',
        'c-1001',
        'amina.okafor',
        'amina',
      ].includes(trimmedId.toLowerCase())

      if (!isDemoAccount) {
        setError('Account not found. Register first or use the account number and username from your registration.')
        return
      }

      // Default demo or seed consumer matching (Amina Okafor)
      const consumerUser = {
        username: 'amina.okafor',
        role: 'House Hold',
        fullName: 'Amina Okafor',
        consumerId: 'C-1001',
        accountNo: 'ACC-88201',
        meterNo: 'MTR-77291',
        zone: 'Mabuhay',
        address: 'Block 4 Lot 12, Riverdale Heights',
        avatar: 'AO',
        isNewAccount: false,
      }

      onLogin(consumerUser)
      if (flash) flash(`Welcome, ${consumerUser.fullName}! Consumer Portal ready.`)
      onClose()
      return
    }

    // 2. FIELD STAFF & MAINTENANCE LOGIN FLOW
    if (authMode === 'field') {
      const isTomas = trimmedId.toLowerCase().includes('tomas')
      const isGil = trimmedId.toLowerCase().includes('gil')

      const fieldStaffUser = {
        username: trimmedId,
        role: 'Field Staffs',
        fullName: isTomas ? 'Tomas Cruz' : isGil ? 'Gil Santos' : 'Roberto Ramos',
        zone: fieldZone,
        avatar: isTomas ? 'TC' : isGil ? 'GS' : 'RR',
      }

      onLogin(fieldStaffUser)
      if (flash) flash(`Field crew terminal active for ${fieldStaffUser.fullName} (${fieldZone} Sector).`)
      onClose()
      return
    }

    // 3. UTILITY OFFICE / ADMINISTRATOR LOGIN FLOW
    const isPresident = trimmedId.toLowerCase().includes('president') || trimmedId.toLowerCase().includes('salvador') || staffRolePreset === 'president'
    const isCashier = trimmedId.toLowerCase().includes('cashier') || trimmedId.toLowerCase().includes('ana') || staffRolePreset === 'cashier'
    const isOfficeStaff = staffRolePreset === 'office' || (!isPresident && !isCashier && trimmedId.toLowerCase().includes('jamie'))

    const officeUser = {
      username: trimmedId,
      role: isPresident ? 'President' : isCashier ? 'Cashier' : isOfficeStaff ? 'Office Staffs' : 'Administrator',
      fullName: isPresident
        ? 'Engr. Salvador Lambawasa'
        : isCashier
        ? 'Ana Fernandez'
        : isOfficeStaff
        ? 'Jamie Dizon'
        : 'Jamie Dizon',
      avatar: isPresident ? 'SL' : isCashier ? 'AF' : 'JD',
    }

    onLogin(officeUser)
    if (flash) flash(`Logged in as ${officeUser.fullName} (${officeUser.role}).`)
    onClose()
  }

  const themeClass =
    authMode === 'consumer'
      ? 'theme-consumer'
      : authMode === 'field'
      ? 'theme-field'
      : 'theme-admin'

  return (
    <div className="mobile-login-overlay" onClick={onClose}>
      <div className={`mobile-login-card ${themeClass}`} onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button
          className="mobile-login-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        {/* Header Branding */}
        <div className="mobile-login-banner">
          <div className="mobile-login-brand">
            <div className="mobile-login-logo">
              {authMode === 'consumer' ? (
                <Droplet size={20} />
              ) : authMode === 'field' ? (
                <HardHat size={20} />
              ) : staffRolePreset === 'president' ? (
                <Crown size={20} />
              ) : staffRolePreset === 'cashier' ? (
                <Banknote size={20} />
              ) : (
                <Building2 size={20} />
              )}
            </div>
            <div className="mobile-login-titles">
              <h2>
                {authMode === 'consumer'
                  ? 'Household Consumer'
                  : authMode === 'field'
                  ? 'Field Staff Terminal'
                  : staffRolePreset === 'president'
                  ? 'President Suite'
                  : staffRolePreset === 'cashier'
                  ? 'Cashier Counter POS'
                  : 'Operations & Office'}
              </h2>
              <p>
                {authMode === 'consumer'
                  ? 'Check water statements, meter twin & pay bills'
                  : authMode === 'field'
                  ? 'Mobile meter reading, GIS mapping & work orders'
                  : 'Municipal billing runs, counter POS & audit logs'}
              </p>
            </div>
          </div>

          {/* Segmented Role Switcher (Touch-friendly Mobile Tabs) */}
          {!consumerOnly && !consumerAndFieldOnly && (
          <div className="mobile-role-segmented">
            <button
              type="button"
              className={`mobile-role-tab ${authMode === 'field' ? 'active tab-field' : ''}`}
              onClick={() => handleSwitchTab('field', 'field')}
            >
              <HardHat size={14} /> Field Staff
            </button>
            {!consumerAndFieldOnly && <button
              type="button"
              className={`mobile-role-tab ${authMode === 'admin' && staffRolePreset === 'office' ? 'active tab-admin' : ''}`}
              onClick={() => handleSwitchTab('admin', 'office')}
            >
              <Building2 size={14} /> Office Staff
            </button>}
            {!consumerAndFieldOnly && <button
              type="button"
              className={`mobile-role-tab ${authMode === 'admin' && staffRolePreset === 'president' ? 'active tab-admin' : ''}`}
              onClick={() => handleSwitchTab('admin', 'president')}
            >
              <Crown size={14} /> President
            </button>}
            {!consumerAndFieldOnly && <button
              type="button"
              className={`mobile-role-tab ${authMode === 'admin' && staffRolePreset === 'cashier' ? 'active tab-admin' : ''}`}
              onClick={() => handleSwitchTab('admin', 'cashier')}
            >
              <Banknote size={14} /> Cashier
            </button>}
          </div>
          )}
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="mobile-login-body">
          {error && (
            <div className="mobile-error-pill">
              <AlertTriangle size={15} /> {error}
            </div>
          )}

          {/* INPUT 1: CONSUMER vs FIELD vs ADMIN */}
          <div className="mobile-field-group">
            <label className="mobile-field-label">
              <span>
                {authMode === 'consumer'
                  ? 'Account No / Username'
                  : authMode === 'field'
                  ? 'Field Tech Staff ID'
                  : 'Operator Handle'}
              </span>
            </label>
            <div className="mobile-field-input-wrap">
              <span className="mobile-field-icon">
                {authMode === 'field' ? <IdCard size={18} /> : <User size={18} />}
              </span>
              <input
                className="mobile-field-input"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  authMode === 'consumer'
                    ? 'e.g. ACC-88201 or amina.okafor'
                    : authMode === 'field'
                    ? 'e.g. roberto.ramos'
                    : 'e.g. jamie.dizon'
                }
                autoFocus
              />
            </div>
          </div>

          {/* INPUT 2: PASSWORD / PIN */}
          <div className="mobile-field-group">
            <label className="mobile-field-label">
              <span>{authMode === 'consumer' ? 'Security PIN / Password' : 'Staff Passcode'}</span>
            </label>
            <div className="mobile-field-input-wrap">
              <span className="mobile-field-icon"><Lock size={18} /></span>
              <input
                className="mobile-field-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* INPUT 3 (Only for Field Staff): District Zone Selector */}
          {authMode === 'field' && (
            <div className="mobile-field-group">
              <label className="mobile-field-label">
                <span>Assigned Field District Sector</span>
              </label>
              <div className="mobile-field-input-wrap">
                <span className="mobile-field-icon"><MapPin size={18} /></span>
                <select
                  className="mobile-field-select"
                  value={fieldZone}
                  onChange={(e) => setFieldZone(e.target.value)}
                >
                  <option value="Mabuhay">Mabuhay Sector (Main District)</option>
                  <option value="Riverside">Riverside Sector (Mainline 4)</option>
                  <option value="Hillview">Hillview Ridge (Pressure Booster)</option>
                  <option value="East Market">East Market Commercial Hub</option>
                </select>
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button type="submit" className="mobile-login-submit">
            <span>
              {authMode === 'consumer'
                ? 'Sign In to Consumer Portal'
                : authMode === 'field'
                ? 'Access Field Staff Terminal'
                : staffRolePreset === 'president'
                ? 'Enter Executive President Suite'
                : staffRolePreset === 'cashier'
                ? 'Open Cashier POS Terminal'
                : 'Sign In to Operations Suite'}
            </span>
            <ArrowRight size={18} />
          </button>

          {/* Consumer Registration Link */}
          {authMode === 'consumer' && onOpenRegister && (
            <div className="mobile-login-footer">
              <span>New household in Lambawasa?</span>
              <button type="button" onClick={onOpenRegister}>
                Register Account
              </button>
            </div>
          )}
        </form>

      </div>
    </div>
  )
}
