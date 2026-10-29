# Waterline Utility Management - MySQL Database Documentation

A production-ready relational database schema designed for municipal water utilities and cooperatives, providing data structures for user management, household profiling, meter assets, GIS mapping, billing runs, arrears tracking, point of sale, service tickets, and operational audit logs.

---

## 🚀 Quick Connection Details (XAMPP / Localhost)

- **Database Name**: `waterline_db`
- **Host**: `127.0.0.1` / `localhost`
- **Port**: `3306`
- **Default Username**: `root`
- **Default Password**: *(blank by default in XAMPP)*
- **GUI Access**: Open browser to [http://localhost/phpmyadmin](http://localhost/phpmyadmin) and select `waterline_db`.

## PayMongo Live Payments and Payouts

PayMongo checkout uses the server-side `PAYMONGO_SECRET_KEY` environment variable. Do not put the secret key in React code or commit it to the repository.

- A key beginning with `sk_test_` creates test transactions only. They do not move real funds and never appear in payouts.
- A key beginning with `sk_live_` creates live transactions. To receive payouts, the PayMongo account must also be activated and have a verified payout destination and settlement schedule.
- In Windows, set `PAYMONGO_SECRET_KEY` in the environment available to Apache, then restart Apache from the XAMPP Control Panel. Use a live secret key from the PayMongo Dashboard for real payments. Keep it private.
- The checkout confirmation in the consumer portal explicitly warns when a test-mode checkout is used.

The application records confirmed payments in its own bill ledger. Payout timing and destination are managed by PayMongo; recording a bill payment does not itself create or accelerate a payout.

---

## 📂 File Manifest

| File | Purpose |
|------|---------|
| [`schema.sql`](file:///c:/Users/User/Desktop/SIA/database/schema.sql) | Complete DDL script creating the application tables, indexes, constraints, and foreign keys. |
| [`seed.sql`](file:///c:/Users/User/Desktop/SIA/database/seed.sql) | Initial dataset including users, consumer profiles, meter assets, sample bills, POS receipts, tickets, and audit trails. |
| `migration_remove_tariff_rates_table.sql` | Drops the obsolete tariff configuration table; billing uses fixed rates in the application. |
| [`migration_centralized_boundaries.sql`](file:///c:/Users/User/Desktop/SIA/database/migration_centralized_boundaries.sql) | Adds shared service/cluster polygons and permits President-created zone names. |

---

## 🗄️ Database Tables Overview

### 1. `users` (System Users & Authentication)
Stores administrators, cashiers, technicians, and system operators with role-based access control.
- `id`: Primary key (INT AUTO_INCREMENT)
- `username`: Unique login handle (VARCHAR(50))
- `password_hash`: Secure bcrypt password hash (VARCHAR(255))
- `full_name`: Complete name of staff member (VARCHAR(100))
- `email`: Contact email address (VARCHAR(100) UNIQUE)
- `contact_no`: Mobile number
- `role`: `Administrator`, `Cashier`, `Technician`, `Billing Officer`
- `status`: `Active`, `Inactive`, `Suspended`
- `last_login`: Timestamp of recent authentication
- `created_at` / `updated_at`: Audit timestamps

### 2. `consumers` (Household Profiling)
Manages complete and updated consumer records for accurate account tracking.
- `id`: Primary key
- `consumer_code`: e.g. `C-1001`
- `account_no`: Unique billing account number e.g. `ACC-88201`
- `full_name`: Household head or business entity name
- `contact_no`: Consumer phone number
- `service_address`: Physical delivery location
- `zone`: `Northbank`, `Riverside`, `Hillview`, `East Market`
- `classification`: `Residential`, `Commercial`, `Institutional`
- `meter_serial`: Water meter serial number
- `status`: `Active`, `Overdue`, `Disconnected`, `Pending`
- `connection_date`: Date service was commissioned
- `last_reading`: Most recent verified meter reading (m³)

### 3. `meter_assets` (Hardware Inventory & Specs)
Maintains inventory logs of meter installations, brands, and calibration states.
- `id`: Primary key
- `serial_no`: Unique stamped serial (e.g. `MTR-77291`)
- `brand`: e.g. `Aquaflow Pro`, `HydroMaster`, `Zenner`
- `model`: Model designator e.g. `AF-20-Brass`
- `pipe_size`: Diameter e.g. `1/2 inch`, `1 inch`, `1.5 inch`
- `install_date`: Date deployed to premise
- `consumer_id`: Foreign key linked to `consumers.id`
- `zone`: Sector location
- `last_calibration` / `next_calibration`: Bench test schedule
- `status`: `Active`, `Calibration Due`, `Under Repair`, `Decommissioned`

### 4. `meter_calibrations` (Calibration & Repair Logs)
Records test margins, laboratory accuracy results, and repair histories.
- `id`: Primary key
- `meter_id`: Foreign key linked to `meter_assets.id`
- `calibration_date`: Date tested
- `event_type`: `Routine Calibration`, `Annual Audit Bench Test`, `Dial Repair`
- `technician_name`: Certified technician who performed the test
- `accuracy_margin`: Recorded margin (e.g. `+/- 0.4%`)
- `test_result`: `Passed`, `Failed`, `Needs Overhaul`
- `notes`: Observations and tamper seal notes

### 5. `geo_connections` (Geographical Spatial Nodes)
Coordinates and status markers for spatial GIS mapping and dispatch.
- `id`: Primary key
- `consumer_id`: Foreign key linked to `consumers.id`
- `zone`: Sector zone
- `x_coordinate`, `y_coordinate`: Cadastral / GIS map coordinates
- `status`: `Normal`, `Overdue`, `Maintenance`

Billing uses fixed rules: ₱10 per m³, 10% environmental fee, ₱2 maintenance fee, and a 10% overdue penalty.

### 6. `bills` (Billing Statements Ledger)
Multi-account verified billing runs and statement history.
- `id`: Primary key
- `bill_no`: Statement ID (e.g. `WS-240981`)
- `consumer_id`: Foreign key linked to `consumers.id`
- `billing_period`: Cycle label (e.g. `Aug 01 – Aug 31, 2026`)
- `prev_reading`, `pres_reading`: Historical and present readings
- `consumption_cum`: Computed usage volume in cubic meters
- `base_amount`: Base usage commodity charge
- `env_fee`: 10% environmental fee
- `maint_fee`: Maintenance fee
- `arrears`: Past unpaid balances carried forward
- `penalty`: Computed late penalty
- `total_amount`: Final payable sum
- `status`: `Ready`, `Overdue`, `Paid`, `Disputed`
- `due_date`, `paid_date`, `days_overdue`

### 7. `payments` (P.O.S. Counter Receipts)
Counter cash collections with instant serialized official receipts.
- `id`: Primary key
- `or_number`: Official Receipt number (e.g. `OR-2026-9042`)
- `bill_id`: Foreign key linked to `bills.id`
- `consumer_id`: Foreign key linked to `consumers.id`
- `cashier_id`: Foreign key linked to `users.id`
- `amount_paid`: Actual bill payment collected
- `tendered_amount`: Cash/tender received from consumer
- `change_amount`: Change calculated and returned
- `payment_method`: `Cash`, `GCash`, `Maya`, `Bank Transfer`
- `payment_date`: Timestamp of payment

### 8. `maintenance_tickets` (Service Desk & Complaints)
Consumer support requests, work orders, and field repair logs.
- `id`: Primary key
- `ticket_no`: Ticket ID (e.g. `SR-2026-0182`)
- `consumer_id`: Foreign key linked to `consumers.id`
- `zone`: Affected district zone
- `issue_type`: `Low Water Pressure`, `Pipe Leak Near Curb Stop`, `Meter Calibration`, `Water Discoloration`
- `priority`: `Urgent`, `High`, `Medium`, `Low`
- `status`: `Reported`, `Dispatched`, `In Progress`, `Resolved`
- `assigned_technician_id`: Foreign key linked to `users.id`
- `technician_name`: Name of field lead
- `reported_at`, `resolved_at`
- `description`: Consumer complaint description
- `resolution_notes`: Work done, materials used, and sign-off

### 9. `audit_trail` (Operational Security Ledger)
Comprehensive immutable audit log of operator actions.
- `id`: Primary key
- `log_code`: Audit event ID (e.g. `AUD-901`)
- `user_id`: Operator ID linked to `users.id`
- `user_name`, `user_role`
- `category`: `Billing`, `Payment`, `Consumer`, `Meter`, `Service`, `Arrears`, `Security`
- `action`: Specific activity performed
- `target_entity`: Target account, statement, or asset
- `details`: Extended JSON or descriptive log
- `ip_address`: Terminal workstation IP
- `created_at`: Timestamp

---

## 🛠️ Re-importing or Resetting Database

To reset or re-import the database at any time using PowerShell:

```powershell
# In PowerShell:
Get-Content "c:\Users\User\Desktop\SIA\database\schema.sql" | & "C:\xampp\mysql\bin\mysql.exe" -u root
Get-Content "c:\Users\User\Desktop\SIA\database\seed.sql" | & "C:\xampp\mysql\bin\mysql.exe" -u root
```

Or in Command Prompt (CMD):
```cmd
"C:\xampp\mysql\bin\mysql.exe" -u root < "c:\Users\User\Desktop\SIA\database\schema.sql"
"C:\xampp\mysql\bin\mysql.exe" -u root < "c:\Users\User\Desktop\SIA\database\seed.sql"
```

---

## 💻 Sample Node.js / Express Connection Snippet

If you want to build a backend API for your React app:

```javascript
// db.js
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // default empty for XAMPP
  database: 'waterline_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Example query: Fetch all consumers
export async function getConsumers() {
  const [rows] = await pool.query('SELECT * FROM consumers ORDER BY created_at DESC');
  return rows;
}
```
