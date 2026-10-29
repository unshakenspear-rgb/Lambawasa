-- ====================================================================
-- WATERLINE UTILITY MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Target RDBMS: MySQL 8.0+ / MariaDB 10.4+ (XAMPP / Production)
-- Character Set: utf8mb4 (Full Unicode Support)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `waterline_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `waterline_db`;

-- --------------------------------------------------------------------
-- 1. SYSTEM USERS & ROLES
-- Stores administrators, cashiers, technicians, and system operators
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) NOT NULL UNIQUE,
  `contact_no` VARCHAR(20) DEFAULT NULL,
  `role` ENUM('Administrator', 'Cashier', 'Technician', 'Billing Officer', 'President', 'Office Staffs', 'Field Staffs') NOT NULL DEFAULT 'Cashier',
  `status` ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
  `last_login` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_status` (`status`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 2. HOUSEHOLD PROFILING (CONSUMERS)
-- Manages complete and updated consumer records
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `consumers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `consumer_code` VARCHAR(20) NOT NULL UNIQUE,      -- e.g. C-1001
  `account_no` VARCHAR(30) NOT NULL UNIQUE,         -- e.g. ACC-88201
  `username` VARCHAR(50) DEFAULT NULL UNIQUE,
  `full_name` VARCHAR(120) NOT NULL,
  `contact_no` VARCHAR(25) NOT NULL,
  `service_address` VARCHAR(255) NOT NULL,
  `zone` VARCHAR(100) NOT NULL,
  `classification` ENUM('Residential', 'Commercial', 'Institutional') NOT NULL DEFAULT 'Residential',
  `meter_serial` VARCHAR(50) DEFAULT NULL,
  `status` ENUM('Active', 'Overdue', 'Disconnected', 'Pending') NOT NULL DEFAULT 'Active',
  `approval_status` ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Approved',
  `location_approval_status` ENUM('None', 'Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'None',
  `requested_latitude` DECIMAL(10, 6) DEFAULT NULL,
  `requested_longitude` DECIMAL(10, 6) DEFAULT NULL,
  `connection_date` DATE NOT NULL,
  `last_reading` DECIMAL(10, 2) DEFAULT 0.00,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_consumers_zone` (`zone`),
  INDEX `idx_consumers_status` (`status`),
  INDEX `idx_consumers_class` (`classification`),
  INDEX `idx_consumers_account` (`account_no`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 3. METER ASSETS
-- Maintains detailed inventory of water meter hardware assets
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `meter_assets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `serial_no` VARCHAR(50) NOT NULL UNIQUE,          -- e.g. MTR-77291
  `brand` VARCHAR(60) NOT NULL,                     -- e.g. Aquaflow Pro, HydroMaster
  `model` VARCHAR(60) NOT NULL,                     -- e.g. AF-20-Brass
  `pipe_size` VARCHAR(20) NOT NULL DEFAULT '1/2 inch',
  `install_date` DATE NOT NULL,
  `consumer_id` INT DEFAULT NULL,
  `zone` VARCHAR(100) NOT NULL,
  `last_calibration` DATE DEFAULT NULL,
  `next_calibration` DATE DEFAULT NULL,
  `status` ENUM('Active', 'Calibration Due', 'Under Repair', 'Disconnected', 'Decommissioned') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_meters_consumer` FOREIGN KEY (`consumer_id`) 
    REFERENCES `consumers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_meters_status` (`status`),
  INDEX `idx_meters_zone` (`zone`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 4. METER CALIBRATION & MAINTENANCE HISTORY
-- Logs calibration schedules, laboratory tests, and field repairs
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `meter_calibrations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `meter_id` INT NOT NULL,
  `calibration_date` DATE NOT NULL,
  `event_type` VARCHAR(80) NOT NULL,               -- Routine Calibration, Annual Audit Bench Test, Dial Repair
  `technician_name` VARCHAR(100) NOT NULL,
  `accuracy_margin` VARCHAR(30) DEFAULT '+/- 0.5%',
  `test_result` ENUM('Passed', 'Failed', 'Needs Overhaul') NOT NULL DEFAULT 'Passed',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_calibrations_meter` FOREIGN KEY (`meter_id`) 
    REFERENCES `meter_assets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_calibrations_date` (`calibration_date`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 5. GEOGRAPHICAL MAPPING (GIS NODES)
-- Spatial mapping of connections for locational dispatch
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `geo_connections` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `consumer_id` INT NOT NULL,
  `zone` VARCHAR(100) NOT NULL,
  `latitude` DECIMAL(10, 6) NOT NULL,              -- Google Maps Latitude (e.g. 14.618500)
  `longitude` DECIMAL(10, 6) NOT NULL,             -- Google Maps Longitude (e.g. 121.032000)
  `status` ENUM('Normal', 'Overdue', 'Maintenance') NOT NULL DEFAULT 'Normal',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_geo_consumer` FOREIGN KEY (`consumer_id`) 
    REFERENCES `consumers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_geo_zone` (`zone`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 6. BILLING STATEMENTS
-- Multi-account verified billing ledger
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `bills` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bill_no` VARCHAR(30) NOT NULL UNIQUE,            -- e.g. WS-240981
  `consumer_id` INT NOT NULL,
  `billing_period` VARCHAR(60) NOT NULL,           -- e.g. Aug 01 – Aug 31, 2026
  `prev_reading` DECIMAL(10, 2) NOT NULL,
  `pres_reading` DECIMAL(10, 2) NOT NULL,
  `consumption_cum` DECIMAL(10, 2) NOT NULL,
  `base_amount` DECIMAL(10, 2) NOT NULL,
  `env_fee` DECIMAL(10, 2) NOT NULL,
  `maint_fee` DECIMAL(10, 2) NOT NULL,
  `arrears` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `penalty` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('Ready', 'Overdue', 'Paid', 'Disputed') NOT NULL DEFAULT 'Ready',
  `due_date` DATE NOT NULL,
  `paid_date` DATE DEFAULT NULL,
  `days_overdue` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bills_consumer` FOREIGN KEY (`consumer_id`) 
    REFERENCES `consumers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_bills_status` (`status`),
  INDEX `idx_bills_due_date` (`due_date`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 7. METER READING APPROVALS
-- Field readings remain pending until reviewed by Office Staff.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `meter_readings` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `reading_code` VARCHAR(64) NOT NULL UNIQUE,
  `consumer_id` INT NOT NULL,
  `meter_serial` VARCHAR(50) NOT NULL,
  `previous_reading` DECIMAL(10, 2) NOT NULL,
  `current_reading` DECIMAL(10, 2) NOT NULL,
  `classification` ENUM('Residential', 'Commercial', 'Institutional') NOT NULL DEFAULT 'Residential',
  `recorded_by_name` VARCHAR(100) NOT NULL,
  `status` ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  `reviewed_by_name` VARCHAR(100) DEFAULT NULL,
  `reviewed_at` DATETIME DEFAULT NULL,
  `bill_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_meter_readings_consumer` FOREIGN KEY (`consumer_id`)
    REFERENCES `consumers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_meter_readings_bill` FOREIGN KEY (`bill_id`)
    REFERENCES `bills` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_meter_readings_status_created` (`status`, `created_at`),
  INDEX `idx_meter_readings_consumer_status` (`consumer_id`, `status`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 8. PAYMENT TRANSACTIONS & OFFICIAL RECEIPTS (P.O.S.)
-- Counter payments with official receipt generation and ledger update
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `or_number` VARCHAR(30) NOT NULL UNIQUE,          -- e.g. OR-2026-9042
  `bill_id` INT NOT NULL,
  `consumer_id` INT NOT NULL,
  `cashier_id` INT DEFAULT NULL,
  `amount_paid` DECIMAL(10, 2) NOT NULL,
  `tendered_amount` DECIMAL(10, 2) NOT NULL,
  `change_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('Cash', 'GCash', 'Maya', 'Bank Transfer') NOT NULL DEFAULT 'Cash',
  `payment_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` VARCHAR(255) DEFAULT NULL,
  CONSTRAINT `fk_payments_bill` FOREIGN KEY (`bill_id`) 
    REFERENCES `bills` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_consumer` FOREIGN KEY (`consumer_id`) 
    REFERENCES `consumers` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_payments_cashier` FOREIGN KEY (`cashier_id`) 
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_payments_date` (`payment_date`),
  INDEX `idx_payments_method` (`payment_method`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 9. MAINTENANCE & COMPLAINT SERVICE TICKETS
-- Consumer support requests and field work order tracking
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `maintenance_tickets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_no` VARCHAR(30) NOT NULL UNIQUE,          -- e.g. SR-2026-0182
  `consumer_id` INT NOT NULL,
  `zone` VARCHAR(100) NOT NULL,
  `issue_type` VARCHAR(100) NOT NULL,               -- Low Water Pressure, Pipe Leak, Meter Calibration
  `priority` ENUM('Urgent', 'High', 'Medium', 'Low') NOT NULL DEFAULT 'Medium',
  `status` ENUM('Reported', 'Pending', 'Dispatched', 'In Progress', 'Resolved') NOT NULL DEFAULT 'Reported',
  `assigned_technician_id` INT DEFAULT NULL,
  `technician_name` VARCHAR(100) DEFAULT NULL,
  `reported_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` DATETIME DEFAULT NULL,
  `description` TEXT NOT NULL,
  `resolution_notes` TEXT DEFAULT NULL,
  CONSTRAINT `fk_tickets_consumer` FOREIGN KEY (`consumer_id`) 
    REFERENCES `consumers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_tickets_tech` FOREIGN KEY (`assigned_technician_id`) 
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_tickets_status` (`status`),
  INDEX `idx_tickets_priority` (`priority`),
  INDEX `idx_tickets_zone` (`zone`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 10. OPERATIONAL AUDIT TRAIL
-- Immutable log of user actions and system events for accountability
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_trail` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `log_code` VARCHAR(30) NOT NULL UNIQUE,           -- e.g. AUD-901
  `user_id` INT DEFAULT NULL,
  `user_name` VARCHAR(100) NOT NULL,
  `user_role` VARCHAR(50) NOT NULL,
  `category` ENUM('Billing', 'Payment', 'Consumer', 'Meter', 'Service', 'Arrears', 'Security') NOT NULL,
  `action` VARCHAR(120) NOT NULL,
  `target_entity` VARCHAR(120) NOT NULL,
  `details` TEXT NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) 
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_audit_category` (`category`),
  INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 11. NOTIFICATIONS LOG (AUTOMATED & MANUAL)
-- Track billing notices, payment reminders, and overdue warnings
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `notification_code` VARCHAR(30) NOT NULL UNIQUE,     -- e.g. NTF-001
  `type` ENUM('Billing Notice', 'Payment Reminder', 'Overdue Notice', 'Service Alert') NOT NULL,
  `recipient_name` VARCHAR(120) NOT NULL,
  `account_no` VARCHAR(30) NOT NULL,
  `message` TEXT NOT NULL,
  `channel` ENUM('SMS', 'Email', 'System Push') NOT NULL DEFAULT 'SMS',
  `status` ENUM('Sent', 'Failed', 'Pending') NOT NULL DEFAULT 'Sent',
  `sent_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notifications_account` (`account_no`),
  INDEX `idx_notifications_type` (`type`),
  INDEX `idx_notifications_sent_at` (`sent_at`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 12. SHARED GIS BOUNDARIES
-- President-approved service and cluster polygons shared by every role
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_boundaries` (
  `boundary_key` VARCHAR(50) PRIMARY KEY,
  `boundary_data` JSON NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `billing_runs` (
  `run_key` VARCHAR(20) PRIMARY KEY,
  `billing_period` VARCHAR(60) NOT NULL,
  `run_date` DATE NOT NULL,
  `inserted_count` INT NOT NULL DEFAULT 0,
  `notification_count` INT NOT NULL DEFAULT 0,
  `status` ENUM('Running', 'Completed', 'Failed') NOT NULL DEFAULT 'Running',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `completed_at` DATETIME DEFAULT NULL
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 13. BILLING ADJUSTMENT AUDIT & APPROVALS
-- Formal audit requests and President/Admin approvals for bill adjustments
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `billing_adjustments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `adjustment_code` VARCHAR(30) NOT NULL UNIQUE,       -- e.g. ADJ-01
  `bill_id` INT NOT NULL,
  `account_no` VARCHAR(30) NOT NULL,
  `consumer_name` VARCHAR(120) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `adjustment_amount` DECIMAL(10, 2) NOT NULL,
  `requested_by` VARCHAR(100) NOT NULL,
  `approved_by` VARCHAR(100) DEFAULT NULL,
  `status` ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_adj_bill` FOREIGN KEY (`bill_id`)
    REFERENCES `bills` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX `idx_adj_status` (`status`)
) ENGINE=InnoDB;

-- --------------------------------------------------------------------
-- 13. CONSUMER SERVICE RATINGS & FEEDBACK
-- Consumer satisfaction feedback for resolved maintenance/service tickets
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `service_ratings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `ticket_no` VARCHAR(30) NOT NULL,
  `consumer_id` INT NOT NULL,
  `consumer_name` VARCHAR(120) NOT NULL,
  `rating` INT NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
  `feedback` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_ratings_ticket` (`ticket_no`),
  INDEX `idx_ratings_consumer` (`consumer_id`)
) ENGINE=InnoDB;
