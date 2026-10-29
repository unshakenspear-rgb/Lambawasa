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
