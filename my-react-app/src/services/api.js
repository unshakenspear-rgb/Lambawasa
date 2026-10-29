// Frontend API Service communicating with XAMPP MySQL waterline_db via PHP endpoints

const getApiUrl = (endpoint) => {
  // Vite serves the frontend on its own port; PHP remains on XAMPP's web server.
  const vitePort = Number(window.location.port)
  const isViteServer = vitePort === 4173 || (vitePort >= 5173 && vitePort <= 5199)
  const base = isViteServer
    ? `${window.location.protocol}//${window.location.hostname}/SIA/api`
    : `${window.location.origin}/SIA/api`
  return `${base}/${endpoint}`
}

export const api = {
  // Check Database Connection & Server Health
  async checkDbStatus() {
    try {
      const res = await fetch(getApiUrl('status.php'), { method: 'GET' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      console.warn('DB Status Check Error:', err)
      return { success: true, connected: false, mode: 'local', error: err.message }
    }
  },

  // Fetch all initial data from MySQL waterline_db
  async fetchSystemData() {
    try {
      const res = await fetch(getApiUrl('data.php'), { method: 'GET' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.success && json.data) {
        return json.data
      }
      throw new Error(json.error || 'Failed to parse database data')
    } catch (err) {
      console.error('Failed to fetch system data from database:', err)
      return null
    }
  },

  async saveBoundaries(serviceBoundary, clusterBoundaries) {
    try {
      const res = await fetch(getApiUrl('boundaries.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceBoundary, clusterBoundaries }),
      })
      return await res.json()
    } catch (err) {
      localStorage.setItem('lambawasa_serviceBoundary', JSON.stringify(serviceBoundary))
      localStorage.setItem('lambawasa_clusterBoundaries', JSON.stringify(clusterBoundaries))
      return { success: true, mode: 'local' }
    }
  },

  // Create Consumer
  async addConsumer(consumerData) {
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consumerData),
      })
      return await res.json()
    } catch (err) {
      console.error('API addConsumer error:', err)
      return { success: false, error: err.message }
    }
  },

  async updateConsumerApproval(consumerId, approvalStatus) {
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId, approvalStatus }),
      })
      return await res.json()
    } catch (err) {
      console.error('API updateConsumerApproval error:', err)
      return { success: false, error: err.message }
    }
  },

  async deleteConsumer(consumerId, actorRole) {
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId, actorRole }),
      })
      return await res.json()
    } catch (err) {
      console.error('API deleteConsumer error:', err)
      return { success: false, error: err.message }
    }
  },

  async updateConsumerProfile(profileData) {
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'profile-update', ...profileData }),
      })
      return await res.json()
    } catch (err) {
      console.error('API updateConsumerProfile error:', err)
      return { success: false, error: err.message }
    }
  },

  async requestConsumerLocationChange(consumerId, latitude, longitude) {
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'location-request', consumerId, latitude, longitude }),
      })
      return await res.json()
    } catch (err) {
      console.error('API requestConsumerLocationChange error:', err)
      return { success: false, error: err.message }
    }
  },

  async decideConsumerLocationChange(consumerId, locationApprovalStatus) {
    try {
      const res = await fetch(getApiUrl('consumers.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'location-decision', consumerId, locationApprovalStatus }),
      })
      return await res.json()
    } catch (err) {
      console.error('API decideConsumerLocationChange error:', err)
      return { success: false, error: err.message }
    }
  },

  // Process POS Payment
  async processPayment(paymentData) {
    try {
      const res = await fetch(getApiUrl('payments.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      })
      return await res.json()
    } catch (err) {
      console.error('API processPayment error:', err)
      return { success: false, error: err.message }
    }
  },

  // Create PayMongo Checkout Session
  async getPaymongoConfig() {
    try {
      const res = await fetch(getApiUrl('paymongo.php?action=config'))
      return await res.json()
    } catch (err) {
      console.error('API getPaymongoConfig error:', err)
      return { success: false, configured: false, error: err.message }
    }
  },

  async createPaymongoCheckout(checkoutData) {
    try {
      const res = await fetch(getApiUrl('paymongo.php?action=create-checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData),
      })
      return await res.json()
    } catch (err) {
      console.error('API createPaymongoCheckout error:', err)
      return { success: false, error: err.message }
    }
  },

  // Verify PayMongo Checkout Session
  async verifyPaymongoSession(sessionId) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(
        getApiUrl(`paymongo.php?action=verify&session_id=${encodeURIComponent(sessionId)}`),
        { signal: controller.signal }
      )
      return await res.json()
    } catch (err) {
      console.error('API verifyPaymongoSession error:', err)
      return {
        success: false,
        error: err.name === 'AbortError'
          ? 'PayMongo verification timed out. Please tap Verify & Complete to try again.'
          : err.message,
      }
    } finally {
      window.clearTimeout(timeoutId)
    }
  },

  // Queue Bill
  async queueBill(billData) {
    try {
      const res = await fetch(getApiUrl('bills.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'single', ...billData }),
      })
      return await res.json()
    } catch (err) {
      console.error('API queueBill error:', err)
      return { success: false, error: err.message }
    }
  },

  async deleteBill(billId, actorName, actorRole) {
    try {
      const res = await fetch(getApiUrl('bills.php'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, actorName, actorRole }),
      })
      const result = await res.json()
      if (!res.ok && result.success) {
        return { success: false, error: `HTTP ${res.status}` }
      }
      return result
    } catch (err) {
      console.error('API deleteBill error:', err)
      return { success: false, error: err.message }
    }
  },

  async updateBillArrears(adjustment) {
    try {
      const res = await fetch(getApiUrl('bills.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustment),
      })
      return await res.json()
    } catch (err) {
      console.error('API updateBillArrears error:', err)
      return { success: false, error: err.message }
    }
  },

  async submitMeterReading(reading) {
    try {
      const res = await fetch(getApiUrl('meter_readings.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reading),
      })
      const result = await res.json()
      if (!res.ok && result.success) {
        return { success: false, error: `HTTP ${res.status}` }
      }
      return result
    } catch (err) {
      console.error('API submitMeterReading error:', err)
      return { success: false, error: err.message }
    }
  },

  async correctMeterReading(reading) {
    try {
      const res = await fetch(getApiUrl('meter_readings.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'president-correction', ...reading }),
      })
      const result = await res.json()
      if (!res.ok && result.success) {
        return { success: false, error: `HTTP ${res.status}` }
      }
      return result
    } catch (err) {
      console.error('API correctMeterReading error:', err)
      return { success: false, error: err.message }
    }
  },

  async decideMeterReading(readingId, decision, actorName, actorRole, bill = null) {
    try {
      const res = await fetch(getApiUrl('meter_readings.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ readingId, decision, actorName, actorRole, bill }),
      })
      const result = await res.json()
      if (!res.ok && result.success) {
        return { success: false, error: `HTTP ${res.status}` }
      }
      return result
    } catch (err) {
      console.error('API decideMeterReading error:', err)
      return { success: false, error: err.message }
    }
  },

  // Batch Bills
  async batchBills(cycle, targetZone, billsList) {
    try {
      const res = await fetch(getApiUrl('bills.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'batch', cycle, targetZone, bills: billsList }),
      })
      return await res.json()
    } catch (err) {
      console.error('API batchBills error:', err)
      return { success: false, error: err.message }
    }
  },

  async runScheduledBilling() {
    try {
      const res = await fetch(getApiUrl('bills.php?action=scheduled'), { method: 'GET' })
      return await res.json()
    } catch (err) {
      console.error('API scheduled billing error:', err)
      return { success: false, error: err.message }
    }
  },

  // Create Maintenance Ticket
  async createTicket(ticketData) {
    try {
      const res = await fetch(getApiUrl('tickets.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })
      return await res.json()
    } catch (err) {
      console.error('API createTicket error:', err)
      return { success: false, error: err.message }
    }
  },

  // Update Maintenance Ticket Status
  async updateTicket(ticketData) {
    try {
      const res = await fetch(getApiUrl('tickets.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })
      return await res.json()
    } catch (err) {
      console.error('API updateTicket error:', err)
      return { success: false, error: err.message }
    }
  },

  // Add Meter Asset
  async addMeter(meterData) {
    try {
      const res = await fetch(getApiUrl('meters.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meterData),
      })
      return await res.json()
    } catch (err) {
      console.error('API addMeter error:', err)
      return { success: false, error: err.message }
    }
  },

  // Update Meter Asset
  async updateMeter(meterData) {
    try {
      const res = await fetch(getApiUrl('meters.php'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(meterData),
      })
      return await res.json()
    } catch (err) {
      console.error('API updateMeter error:', err)
      return { success: false, error: err.message }
    }
  },

  // Delete Meter Asset
  async deleteMeter(serialNo, actorRole) {
    try {
      const res = await fetch(getApiUrl('meters.php'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serialNo, actorRole }),
      })
      return await res.json()
    } catch (err) {
      console.error('API deleteMeter error:', err)
      return { success: false, error: err.message }
    }
  },

  // Record Audit Trail
  async recordAudit(auditData) {
    try {
      const res = await fetch(getApiUrl('audit.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData),
      })
      return await res.json()
    } catch (err) {
      console.error('API recordAudit error:', err)
      return { success: false, error: err.message }
    }
  },

  async createNotification(notificationData) {
    try {
      const res = await fetch(getApiUrl('notifications.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationData),
      })
      return await res.json()
    } catch (err) {
      console.error('API createNotification error:', err)
      return { success: false, error: err.message }
    }
  },

  // Auth: Login
  async login(username, password) {
    try {
      const res = await fetch(getApiUrl('auth.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
      })
      return await res.json()
    } catch (err) {
      console.error('API login error:', err)
      return { success: false, error: err.message }
    }
  },

  // Auth: Register
  async register(userData) {
    try {
      const res = await fetch(getApiUrl('auth.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...userData }),
      })
      return await res.json()
    } catch (err) {
      console.error('API register error:', err)
      return { success: false, error: err.message }
    }
  },

}

export default api
