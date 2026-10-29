-- ====================================================================
-- WATERLINE UTILITY MANAGEMENT SYSTEM - SEED DATA
-- Target Database: waterline_db
-- ====================================================================

USE `waterline_db`;

-- 1. SEED SYSTEM USERS
INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `email`, `contact_no`, `role`, `status`) VALUES
(1, 'jamie.dizon', '$2y$10$e8K3zW1QZ1fO9GgVvB.NWe6c/XQ5Cq0fN8.f6E1W8h.rT4a1mGqGy', 'Jamie Dizon', 'jamie.dizon@waterline.gov.ph', '+63 917 111 2233', 'Administrator', 'Active'),
(2, 'roberto.ramos', '$2y$10$e8K3zW1QZ1fO9GgVvB.NWe6c/XQ5Cq0fN8.f6E1W8h.rT4a1mGqGy', 'Roberto Ramos', 'roberto.ramos@waterline.gov.ph', '+63 918 222 3344', 'Technician', 'Active'),
(3, 'tomas.cruz', '$2y$10$e8K3zW1QZ1fO9GgVvB.NWe6c/XQ5Cq0fN8.f6E1W8h.rT4a1mGqGy', 'Tomas Cruz', 'tomas.cruz@waterline.gov.ph', '+63 919 333 4455', 'Technician', 'Active'),
(4, 'gil.santos', '$2y$10$e8K3zW1QZ1fO9GgVvB.NWe6c/XQ5Cq0fN8.f6E1W8h.rT4a1mGqGy', 'Gil Santos', 'gil.santos@waterline.gov.ph', '+63 920 444 5566', 'Technician', 'Active'),
(5, 'cashier1', '$2y$10$e8K3zW1QZ1fO9GgVvB.NWe6c/XQ5Cq0fN8.f6E1W8h.rT4a1mGqGy', 'Counter Cashier Alpha', 'cashier1@waterline.gov.ph', '+63 921 555 6677', 'Cashier', 'Active');

-- 2. SEED CONSUMERS (HOUSEHOLD PROFILES)
INSERT INTO `consumers` (`id`, `consumer_code`, `account_no`, `full_name`, `contact_no`, `service_address`, `zone`, `classification`, `meter_serial`, `status`, `connection_date`, `last_reading`) VALUES
(1, 'C-1001', 'ACC-88201', 'Amina Okafor', '+63 917 234 5678', 'Block 4 Lot 12, Riverdale Heights', 'Mabuhay', 'Residential', 'MTR-77291', 'Active', '2024-03-15', 148.00),
(2, 'C-1002', 'ACC-88202', 'Caleb Mensah', '+63 928 345 6789', '15 Magsaysay St., Barangay Riverside', 'Riverside', 'Residential', 'MTR-77292', 'Overdue', '2023-11-20', 215.00),
(3, 'C-1003', 'ACC-88203', 'Lina Santos', '+63 919 456 7890', '74 Hillcrest Drive, Hillview', 'Hillview', 'Commercial', 'MTR-77293', 'Active', '2024-01-10', 342.00),
(4, 'C-1004', 'ACC-88204', 'Marco Dela Cruz', '+63 905 567 8901', '89 Commercial Hub, East Market', 'East Market', 'Commercial', 'MTR-77294', 'Active', '2023-08-04', 198.00),
(5, 'C-1005', 'ACC-88205', 'Elena Rostova', '+63 945 678 9012', '22 Palm Grove Avenue', 'Mabuhay', 'Residential', 'MTR-77295', 'Active', '2024-05-18', 89.00),
(6, 'C-1006', 'ACC-88206', 'Danilo Aquino', '+63 918 789 0123', '44 Fisherman Wharf', 'Riverside', 'Residential', 'MTR-77296', 'Overdue', '2022-09-12', 412.00),
(7, 'C-1007', 'ACC-88207', 'Sophia Villanueva', '+63 920 890 1234', '101 Summit Ridge, Hillview', 'Hillview', 'Residential', 'MTR-77297', 'Active', '2024-02-28', 165.00),
(8, 'C-1008', 'ACC-88208', 'Victor Tan Bakery', '+63 917 901 2345', '12 Central Plaza, East Market', 'East Market', 'Commercial', 'MTR-77298', 'Active', '2023-04-14', 512.00);

-- 4. SEED METER ASSETS
INSERT INTO `meter_assets` (`id`, `serial_no`, `brand`, `model`, `pipe_size`, `install_date`, `consumer_id`, `zone`, `last_calibration`, `next_calibration`, `status`) VALUES
(1, 'MTR-77291', 'Aquaflow Pro', 'AF-20-Brass', '1/2 inch', '2024-03-15', 1, 'Mabuhay', '2025-03-10', '2027-03-10', 'Active'),
(2, 'MTR-77292', 'HydroMaster', 'HM-15D', '1/2 inch', '2023-11-20', 2, 'Riverside', '2024-11-15', '2026-11-15', 'Active'),
(3, 'MTR-77293', 'Zenner Commercial', 'ZN-25-Ind', '1 inch', '2024-01-10', 3, 'Hillview', '2025-01-08', '2026-07-08', 'Calibration Due'),
(4, 'MTR-77294', 'Zenner Commercial', 'ZN-25-Ind', '1 inch', '2023-08-04', 4, 'East Market', '2024-08-01', '2026-08-01', 'Active'),
(5, 'MTR-77295', 'Aquaflow Pro', 'AF-20-Brass', '1/2 inch', '2024-05-18', 5, 'Mabuhay', '2024-05-18', '2026-05-18', 'Active'),
(6, 'MTR-77296', 'HydroMaster', 'HM-15D', '1/2 inch', '2022-09-12', 6, 'Riverside', '2024-09-10', '2025-09-10', 'Under Repair'),
(7, 'MTR-77297', 'Aquaflow Pro', 'AF-20-Brass', '1/2 inch', '2024-02-28', 7, 'Hillview', '2024-02-28', '2026-02-28', 'Active'),
(8, 'MTR-77298', 'Zenner Commercial', 'ZN-40-Bulk', '1.5 inch', '2023-04-14', 8, 'East Market', '2025-04-10', '2026-10-10', 'Active');

-- 5. SEED METER CALIBRATION HISTORY
INSERT INTO `meter_calibrations` (`meter_id`, `calibration_date`, `event_type`, `technician_name`, `accuracy_margin`, `test_result`, `notes`) VALUES
(1, '2024-03-15', 'Installation', 'Roberto Ramos', '+/- 0.3%', 'Passed', 'Initial installation inspection completed without issue.'),
(1, '2025-03-10', 'Routine Calibration', 'Tomas Cruz', '+/- 0.4%', 'Passed', 'Calibrated on mobile test bench; certified margin compliant.'),
(2, '2023-11-20', 'Installation', 'Gil Santos', '+/- 0.5%', 'Passed', 'Installed with dual-check backflow preventer.'),
(3, '2025-01-08', 'Annual Calibration', 'Tomas Cruz', '+/- 0.8%', 'Needs Overhaul', 'Passed with minor dial adjustment; scheduled for replacement next cycle.'),
(6, '2026-08-28', 'Repair Scheduled', 'Roberto Ramos', '+/- 1.4%', 'Failed', 'Consumer reported glass fogging and condensation.');

-- 6. SEED GEOGRAPHICAL CONNECTIONS (GOOGLE MAPS GIS)
INSERT INTO `geo_connections` (`consumer_id`, `zone`, `latitude`, `longitude`, `status`) VALUES
(1, 'Mabuhay', 14.618500, 121.032000, 'Normal'),
(2, 'Riverside', 14.595000, 121.054000, 'Overdue'),
(3, 'Hillview', 14.582000, 121.062000, 'Normal'),
(4, 'East Market', 14.575000, 121.038000, 'Normal'),
(5, 'Mabuhay', 14.624000, 121.026000, 'Normal'),
(6, 'Riverside', 14.602000, 121.061000, 'Maintenance'),
(7, 'Hillview', 14.579000, 121.071000, 'Normal'),
(8, 'East Market', 14.571000, 121.045000, 'Normal');

-- 7. SEED BILLING STATEMENTS
INSERT INTO `bills` (`id`, `bill_no`, `consumer_id`, `billing_period`, `prev_reading`, `pres_reading`, `consumption_cum`, `base_amount`, `env_fee`, `maint_fee`, `arrears`, `penalty`, `total_amount`, `status`, `due_date`, `days_overdue`) VALUES
(1, 'WS-240981', 1, 'Aug 01 – Aug 31, 2026', 124.00, 148.00, 24.00, 1317.00, 131.70, 25.00, 0.00, 0.00, 1473.70, 'Ready', '2026-09-20', 0),
(2, 'WS-240977', 2, 'Jul 01 – Jul 31, 2026', 198.00, 215.00, 17.00, 828.50, 82.85, 25.00, 0.00, 82.85, 1019.20, 'Overdue', '2026-08-20', 14),
(3, 'WS-240973', 3, 'Aug 01 – Aug 31, 2026', 312.00, 342.00, 30.00, 1880.00, 188.00, 40.00, 0.00, 0.00, 2108.00, 'Ready', '2026-09-22', 0),
(4, 'WS-240966', 4, 'Aug 01 – Aug 31, 2026', 185.00, 198.00, 13.00, 654.00, 65.40, 25.00, 0.00, 0.00, 744.40, 'Paid', '2026-09-18', 0),
(5, 'WS-240955', 6, 'Jun 01 – Jun 30, 2026', 370.00, 412.00, 42.00, 1680.00, 168.00, 25.00, 1250.00, 293.00, 3416.00, 'Overdue', '2026-07-20', 45);

-- 8. SEED PAYMENT TRANSACTIONS (P.O.S.)
INSERT INTO `payments` (`id`, `or_number`, `bill_id`, `consumer_id`, `cashier_id`, `amount_paid`, `tendered_amount`, `change_amount`, `payment_method`, `payment_date`, `notes`) VALUES
(1, 'OR-2026-9041', 4, 4, 1, 744.40, 1000.00, 255.60, 'Cash', '2026-09-02 14:28:10', 'Over-the-counter bill settlement.'),
(2, 'OR-2026-9040', 1, 5, 1, 580.00, 580.00, 0.00, 'GCash', '2026-09-02 10:15:45', 'Digital wallet instant settlement.');

-- 9. SEED MAINTENANCE & COMPLAINT TICKETS
INSERT INTO `maintenance_tickets` (`id`, `ticket_no`, `consumer_id`, `zone`, `issue_type`, `priority`, `status`, `assigned_technician_id`, `technician_name`, `reported_at`, `description`, `resolution_notes`) VALUES
(1, 'SR-2026-0182', 6, 'Riverside', 'Low Water Pressure', 'Urgent', 'In Progress', 2, 'Roberto Ramos', '2026-09-03 08:42:00', 'Mainline pressure drop observed in Sector 4 branch line.', 'Technician dispatched to inspect pressure valve regulator #3.'),
(2, 'SR-2026-0181', 3, 'Hillview', 'Meter Calibration Request', 'Medium', 'Dispatched', 3, 'Tomas Cruz', '2026-09-03 06:15:00', 'Consumer requested annual checkup before peak season.', 'Work order printed and queued for field calibration van.'),
(3, 'SR-2026-0180', 1, 'Mabuhay', 'Pipe Leak Near Curb Stop', 'High', 'Resolved', 4, 'Gil Santos', '2026-09-02 13:20:00', 'Minor moisture leak near water meter shutoff valve.', 'Replaced Teflon seal and tightened union connector. Tested leak-free.'),
(4, 'SR-2026-0179', 8, 'East Market', 'Water Discoloration Check', 'Low', 'Resolved', 2, 'Roberto Ramos', '2026-09-01 11:00:00', 'Slight turbidity after municipal mainline maintenance.', 'Flushed fire hydrant for 5 minutes. Water cleared and turbidity tested 0.4 NTU.');

-- 10. SEED OPERATIONAL AUDIT TRAIL
INSERT INTO `audit_trail` (`log_code`, `user_id`, `user_name`, `user_role`, `category`, `action`, `target_entity`, `details`, `ip_address`) VALUES
('AUD-901', 1, 'Jamie Dizon', 'Administrator', 'Billing', 'Verified Meter Reading Run', 'Zone Mabuhay (Cycle 26-08)', 'Verified 48 meter readings with 99.2% confidence score.', '192.168.1.104'),
('AUD-902', 1, 'Jamie Dizon', 'Administrator', 'Service', 'Assigned Work Order', 'SR-2026-0182 (Danilo Aquino)', 'Assigned Roberto Ramos to investigate low water pressure.', '192.168.1.104'),
('AUD-903', 1, 'Jamie Dizon', 'Cashier / POS', 'Payment', 'Processed Counter Payment', 'OR-2026-9042 / Marco Dela Cruz', 'Received ₱ 744.40 cash payment. Bill WS-240966 updated to PAID.', 'POS-TERMINAL-01'),
('AUD-904', NULL, 'System Bot', 'Automated Job', 'Arrears', 'Overdue Penalty Computed', '18 Overdue Accounts', 'Calculated 10% statutory overdue surcharge for accounts past due date.', 'SYSTEM_CRON'),
('AUD-905', 1, 'Jamie Dizon', 'Administrator', 'Meter', 'Updated Meter Calibration Status', 'MTR-77293 (Lina Santos)', 'Flagged meter calibration due date for Q3 audit.', '192.168.1.104');
