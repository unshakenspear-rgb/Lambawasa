import { useState } from 'react'
import {
  LayoutDashboard,
  Calculator,
  Gauge,
  MapPin,
  LifeBuoy,
  LogOut
} from 'lucide-react'
import './FieldStaffNavigation.css'

const fieldDestinations = [
  ['Overview', LayoutDashboard, 'Home'],
  ['Consumption Calculator', Calculator, 'Read Meter'],
  ['Meter Assets', Gauge, 'Meters'],
  ['Geographical Mapping', MapPin, 'Field map'],
  ['Service Desk', LifeBuoy, 'Tickets'],
]

export default function FieldStaffNavigation({ activeNav, onNavigate, complaints = [], onSignOut }) {
  const [isOpen, setIsOpen] = useState(false)
  const openDestination = (destination) => {
    onNavigate(destination === 'Overview' ? 'Overview' : destination)
    setIsOpen(false)
  }
  const openTickets = complaints.filter((complaint) => complaint.status !== 'Resolved').length

  return (
    <div className={`field-staff-navigation ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="field-staff-menu-toggle"
        aria-label={isOpen ? 'Close field staff navigation' : 'Open field staff navigation'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span /><span /><span />
      </button>
      {isOpen && (
        <nav className="field-staff-menu" aria-label="Field Staff Navigation">
          {fieldDestinations.map(([destination, IconComponent, label]) => (
            <button
              type="button"
              key={destination}
              className={activeNav === destination ? 'active' : ''}
              onClick={() => openDestination(destination)}
            >
              <span className="field-menu-icon">
                {typeof IconComponent === 'function' || (typeof IconComponent === 'object' && IconComponent !== null) ? (
                  <IconComponent size={18} strokeWidth={2} />
                ) : (
                  IconComponent
                )}
              </span>
              <span>{label}</span>
              {destination === 'Service Desk' && openTickets > 0 && <b>{openTickets}</b>}
            </button>
          ))}
          <button type="button" className="field-menu-signout" onClick={onSignOut}>
            <span className="field-menu-icon">
              <LogOut size={18} strokeWidth={2} />
            </span>
            <span>Sign out</span>
          </button>
        </nav>
      )}
    </div>
  )
}
