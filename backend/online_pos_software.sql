-- ==========================================================
-- Database Schema for: online_pos_software
-- Auto-Increment Integer IDs (1, 2, 3, 4...) for all tables
-- Compatible with MySQL / MariaDB / Coolify / phpMyAdmin
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------
-- 1. Table: shops
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `shops`;
CREATE TABLE `shops` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `address` TEXT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `contactNumber` VARCHAR(50) NULL,
  `logoUrl` TEXT NULL,
  `ownerFullName` VARCHAR(255) NULL,
  `ownerEmail` VARCHAR(255) NULL,
  `ownerPhone` VARCHAR(50) NULL,
  `bankName` VARCHAR(100) DEFAULT '',
  `bankAccountNumber` VARCHAR(100) DEFAULT '',
  `bankAccountTitle` VARCHAR(150) DEFAULT '',
  `easypaisaNumber` VARCHAR(50) DEFAULT '',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 2. Table: users
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `username` VARCHAR(100) NOT NULL UNIQUE,
  `password` VARCHAR(255) NULL,
  `fullName` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'cashier', 'salesman', 'shop_admin', 'super_admin') NOT NULL DEFAULT 'cashier',
  `shopId` INT NULL,
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `preferredShift` ENUM('day', 'night', 'both') NOT NULL DEFAULT 'both',
  `phoneNumber` VARCHAR(50) NULL,
  `email` VARCHAR(255) NULL,
  `lastLogged` DATETIME NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_users_shopId` (`shopId`),
  CONSTRAINT `fk_users_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 3. Table: items (Products / Stock)
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `items`;
CREATE TABLE `items` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `shopId` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `stock` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `minStock` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `costPrice` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `pricePerPeti` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `pricePerTray` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `pricePerEgg` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `images` LONGTEXT NULL COMMENT 'JSON Array of image URLs',
  `description` LONGTEXT NULL,
  `mfgDate` DATE NULL,
  `expiryDate` DATE NULL,
  `unitType` ENUM('peti', 'tray', 'egg') NOT NULL DEFAULT 'peti',
  `traysPerPeti` INT NOT NULL DEFAULT 12,
  `eggsPerTray` INT NOT NULL DEFAULT 30,
  `petiQuantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `trayQuantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `eggQuantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `supplierName` VARCHAR(255) DEFAULT '',
  `supplierPhone` VARCHAR(50) DEFAULT '',
  `supplierLocation` TEXT NULL,
  `totalPurchaseCost` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `amountPaidToSupplier` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cashPaidToSupplier` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `bankPaidToSupplier` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `dueAmountToSupplier` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paymentMethod` VARCHAR(50) DEFAULT 'Cash',
  `paymentReceipt` TEXT NULL,
  `isOnlinePayment` TINYINT(1) NOT NULL DEFAULT 0,
  `lastUpdated` VARCHAR(50) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_items_shop_cat` (`shopId`, `category`),
  KEY `idx_items_shop_name` (`shopId`, `name`),
  KEY `idx_items_shop_created` (`shopId`, `createdAt`),
  CONSTRAINT `fk_items_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 4. Table: customers
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `customers`;
CREATE TABLE `customers` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `fullName` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) DEFAULT '',
  `address` TEXT NULL,
  `shopId` INT NOT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_shopId` (`shopId`),
  CONSTRAINT `fk_customers_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 5. Table: customer_cart_items
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `customer_cart_items`;
CREATE TABLE `customer_cart_items` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `customerId` INT NOT NULL,
  `itemId` INT NOT NULL,
  `name` VARCHAR(255) NULL,
  `unit` VARCHAR(50) DEFAULT 'egg',
  `price` DECIMAL(12,2) DEFAULT 0.00,
  `image` TEXT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_cart_customer` (`customerId`),
  KEY `idx_cart_item` (`itemId`),
  CONSTRAINT `fk_cart_customerId` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cart_itemId` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 6. Table: orders
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `shopId` INT NOT NULL,
  `customerId` INT NOT NULL,
  `totalAmount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `shippingFullName` VARCHAR(255) NULL,
  `shippingPhone` VARCHAR(50) NULL,
  `shippingAddress` TEXT NULL,
  `shippingCity` VARCHAR(100) NULL,
  `paymentMethod` ENUM('COD', 'STRIPE', 'EASYPAISA') NOT NULL,
  `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `orderStatus` ENUM('PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PROCESSING',
  `transactionId` VARCHAR(255) NULL,
  `paymentProof` TEXT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_shopId` (`shopId`),
  KEY `idx_orders_customerId` (`customerId`),
  CONSTRAINT `fk_orders_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_orders_customerId` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 7. Table: order_items
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `orderId` INT NOT NULL,
  `itemId` INT NULL,
  `name` VARCHAR(255) NULL,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `quantity` INT NOT NULL DEFAULT 1,
  `image` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_orderId` (`orderId`),
  KEY `idx_order_items_itemId` (`itemId`),
  CONSTRAINT `fk_order_items_orderId` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_itemId` FOREIGN KEY (`itemId`) REFERENCES `items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 8. Table: sales
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `sales`;
CREATE TABLE `sales` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `shopId` INT NOT NULL,
  `totalAmount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `totalProfit` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `serialNumber` BIGINT NOT NULL DEFAULT 0,
  `invoiceNumber` VARCHAR(100) DEFAULT '',
  `saleDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` ENUM('completed', 'pending', 'cancelled', 'returned') NOT NULL DEFAULT 'completed',
  `returnReason` TEXT NULL,
  `cashierId` INT NULL,
  `cashierName` VARCHAR(255) NULL,
  `customerName` VARCHAR(255) DEFAULT '',
  `customerPhone` VARCHAR(50) DEFAULT '',
  `paymentMethod` ENUM('CASH', 'BANK_TRANSFER', 'BANK', 'ONLINE', 'EASYPAISA', 'CREDIT', 'DUE', 'SPLIT', 'PARTIAL') NOT NULL DEFAULT 'CASH',
  `cashPaid` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `bankPaid` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `dueAmount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paymentReceipt` TEXT NULL,
  `paymentProof` TEXT NULL,
  `transactionId` VARCHAR(255) DEFAULT '',
  `isCredit` TINYINT(1) NOT NULL DEFAULT 0,
  `orderId` INT NULL,
  `customerId` INT NULL,
  `customerEmail` VARCHAR(255) DEFAULT '',
  `isOnlineOrder` TINYINT(1) NOT NULL DEFAULT 0,
  `orderSource` VARCHAR(100) DEFAULT 'WALK_IN_POS',
  `approvalStatus` ENUM('APPROVED', 'PENDING_APPROVAL', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sales_shop_date` (`shopId`, `saleDate`),
  KEY `idx_sales_shop_created` (`shopId`, `createdAt`),
  KEY `idx_sales_customer` (`customerId`),
  KEY `idx_sales_cashier` (`cashierId`),
  CONSTRAINT `fk_sales_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_cashierId` FOREIGN KEY (`cashierId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_customerId` FOREIGN KEY (`customerId`) REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_sales_orderId` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 9. Table: sale_items
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `sale_items`;
CREATE TABLE `sale_items` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `saleId` INT NOT NULL,
  `productId` INT NULL,
  `name` VARCHAR(255) NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 1,
  `price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `costPrice` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `profit` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_sale_items_saleId` (`saleId`),
  KEY `idx_sale_items_productId` (`productId`),
  CONSTRAINT `fk_sale_items_saleId` FOREIGN KEY (`saleId`) REFERENCES `sales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_sale_items_productId` FOREIGN KEY (`productId`) REFERENCES `items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 10. Table: expenses
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `expenses`;
CREATE TABLE `expenses` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `shopId` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` ENUM('Rent', 'Utilities / Bills', 'Packaging & Bags', 'Transport & Freight', 'Salaries', 'Egg Damage / Loss', 'Other') NOT NULL DEFAULT 'Other',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `paymentMethod` ENUM('CASH', 'BANK', 'ONLINE', 'Paid') NOT NULL DEFAULT 'CASH',
  `paymentSource` ENUM('CASH', 'BANK', 'ONLINE') NOT NULL DEFAULT 'CASH',
  `expenseDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT NULL,
  `createdBy` VARCHAR(255) DEFAULT 'Shop Admin',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expenses_shopId` (`shopId`),
  CONSTRAINT `fk_expenses_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 11. Table: damaged_products
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `damaged_products`;
CREATE TABLE `damaged_products` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `shopId` INT NOT NULL,
  `productName` VARCHAR(255) NOT NULL,
  `productId` INT NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `petiQuantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `trayQuantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `eggQuantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `unitType` VARCHAR(50) DEFAULT 'egg',
  `deductedEggs` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `unitPrice` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `totalLoss` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `reason` ENUM('Egg Breakage / Crack', 'Spoiled / Expired', 'Transport Damage', 'Storage Loss', 'Other') NOT NULL DEFAULT 'Egg Breakage / Crack',
  `damageDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` TEXT NULL,
  `reportedBy` VARCHAR(255) DEFAULT 'Shop Admin',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_damaged_shopId` (`shopId`),
  CONSTRAINT `fk_damaged_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 12. Table: cash_sessions
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `cash_sessions`;
CREATE TABLE `cash_sessions` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `shopId` INT NOT NULL,
  `cashierId` INT NOT NULL,
  `startTime` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `endTime` DATETIME NULL,
  `openingCash` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `closingCash` DECIMAL(12,2) DEFAULT 0.00,
  `totalSales` DECIMAL(12,2) DEFAULT 0.00,
  `totalReturns` DECIMAL(12,2) DEFAULT 0.00,
  `expectedCash` DECIMAL(12,2) DEFAULT 0.00,
  `actualCash` DECIMAL(12,2) DEFAULT 0.00,
  `status` ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  `closedBy` INT NULL,
  `notes` TEXT NULL,
  `shiftType` ENUM('day', 'night') NOT NULL DEFAULT 'day',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cash_shopId` (`shopId`),
  KEY `idx_cash_cashierId` (`cashierId`),
  CONSTRAINT `fk_cash_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cash_cashierId` FOREIGN KEY (`cashierId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_cash_closedBy` FOREIGN KEY (`closedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 13. Table: settings
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `settings`;
CREATE TABLE `settings` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `shopId` INT NOT NULL UNIQUE,
  `shopName` VARCHAR(255) DEFAULT 'Egg Station POS',
  `address` TEXT NULL,
  `phone` VARCHAR(50) DEFAULT '',
  `email` VARCHAR(255) DEFAULT '',
  `currency` VARCHAR(20) DEFAULT '$',
  `logoUrl` TEXT NULL,
  `ownerPassword` VARCHAR(255) DEFAULT 'admin123',
  `taxRate` DECIMAL(5,2) DEFAULT 0.00,
  `ownerFullName` VARCHAR(255) DEFAULT '',
  `ownerEmail` VARCHAR(255) DEFAULT '',
  `ownerPhone` VARCHAR(50) DEFAULT '',
  `easypaisaNumber` VARCHAR(50) DEFAULT '',
  `easypaisaEnabled` TINYINT(1) NOT NULL DEFAULT 0,
  `bankName` VARCHAR(100) DEFAULT '',
  `bankAccountNumber` VARCHAR(100) DEFAULT '',
  `bankAccountTitle` VARCHAR(150) DEFAULT '',
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_settings_shopId` FOREIGN KEY (`shopId`) REFERENCES `shops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 14. Table: system_updates
-- ----------------------------------------------------------
DROP TABLE IF EXISTS `system_updates`;
CREATE TABLE `system_updates` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `category` ENUM('New Features', 'UI Improvements', 'Security & Logic', 'Performance', 'Bug Fixes') NOT NULL,
  `iconType` ENUM('zap', 'sparkles', 'shield', 'box', 'activity') NOT NULL,
  `items` LONGTEXT NOT NULL COMMENT 'JSON Array of update bullets',
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci AUTO_INCREMENT=1;

-- ----------------------------------------------------------
-- 15. Dedicated Branch Physical Tables (Peshawar, Mardan, Attock)
-- ----------------------------------------------------------

-- Peshawar Branch (Shop ID: 1)
CREATE TABLE IF NOT EXISTS `peshawar_items` LIKE `items`;
CREATE TABLE IF NOT EXISTS `peshawar_sales` LIKE `sales`;
CREATE TABLE IF NOT EXISTS `peshawar_sale_items` LIKE `sale_items`;
CREATE TABLE IF NOT EXISTS `peshawar_purchases` LIKE `purchases`;
CREATE TABLE IF NOT EXISTS `peshawar_purchase_credits` LIKE `purchase_credits`;
CREATE TABLE IF NOT EXISTS `peshawar_expenses` LIKE `expenses`;
CREATE TABLE IF NOT EXISTS `peshawar_orders` LIKE `orders`;
CREATE TABLE IF NOT EXISTS `peshawar_order_items` LIKE `order_items`;
CREATE TABLE IF NOT EXISTS `peshawar_customer_credits` LIKE `customer_credits`;
CREATE TABLE IF NOT EXISTS `peshawar_branch__customer_credits` LIKE `customer_credits`;
CREATE TABLE IF NOT EXISTS `peshawar_branch__profit_reports` LIKE `profit_reports`;
CREATE TABLE IF NOT EXISTS `peshawar_cash_sessions` LIKE `cash_sessions`;
CREATE TABLE IF NOT EXISTS `peshawar_damaged_products` LIKE `damaged_products`;
CREATE TABLE IF NOT EXISTS `peshawar_customers` LIKE `customers`;
CREATE TABLE IF NOT EXISTS `peshawar_vendors` LIKE `vendors`;
CREATE TABLE IF NOT EXISTS `peshawar_settings` LIKE `settings`;

-- Mardan Branch (Shop ID: 2)
CREATE TABLE IF NOT EXISTS `mardan_items` LIKE `items`;
CREATE TABLE IF NOT EXISTS `mardan_sales` LIKE `sales`;
CREATE TABLE IF NOT EXISTS `mardan_sale_items` LIKE `sale_items`;
CREATE TABLE IF NOT EXISTS `mardan_purchases` LIKE `purchases`;
CREATE TABLE IF NOT EXISTS `mardan_purchase_credits` LIKE `purchase_credits`;
CREATE TABLE IF NOT EXISTS `mardan_expenses` LIKE `expenses`;
CREATE TABLE IF NOT EXISTS `mardan_orders` LIKE `orders`;
CREATE TABLE IF NOT EXISTS `mardan_order_items` LIKE `order_items`;
CREATE TABLE IF NOT EXISTS `mardan_customer_credits` LIKE `customer_credits`;
CREATE TABLE IF NOT EXISTS `mardan_branch__customer_credits` LIKE `customer_credits`;
CREATE TABLE IF NOT EXISTS `mardan_branch__profit_reports` LIKE `profit_reports`;
CREATE TABLE IF NOT EXISTS `mardan_cash_sessions` LIKE `cash_sessions`;
CREATE TABLE IF NOT EXISTS `mardan_damaged_products` LIKE `damaged_products`;
CREATE TABLE IF NOT EXISTS `mardan_customers` LIKE `customers`;
CREATE TABLE IF NOT EXISTS `mardan_vendors` LIKE `vendors`;
CREATE TABLE IF NOT EXISTS `mardan_settings` LIKE `settings`;

-- Attock Branch (Shop ID: 3)
CREATE TABLE IF NOT EXISTS `attock_items` LIKE `items`;
CREATE TABLE IF NOT EXISTS `attock_sales` LIKE `sales`;
CREATE TABLE IF NOT EXISTS `attock_sale_items` LIKE `sale_items`;
CREATE TABLE IF NOT EXISTS `attock_purchases` LIKE `purchases`;
CREATE TABLE IF NOT EXISTS `attock_purchase_credits` LIKE `purchase_credits`;
CREATE TABLE IF NOT EXISTS `attock_expenses` LIKE `expenses`;
CREATE TABLE IF NOT EXISTS `attock_orders` LIKE `orders`;
CREATE TABLE IF NOT EXISTS `attock_order_items` LIKE `order_items`;
CREATE TABLE IF NOT EXISTS `attock_customer_credits` LIKE `customer_credits`;
CREATE TABLE IF NOT EXISTS `attock_branch__customer_credits` LIKE `customer_credits`;
CREATE TABLE IF NOT EXISTS `attock_branch__profit_reports` LIKE `profit_reports`;
CREATE TABLE IF NOT EXISTS `attock_cash_sessions` LIKE `cash_sessions`;
CREATE TABLE IF NOT EXISTS `attock_damaged_products` LIKE `damaged_products`;
CREATE TABLE IF NOT EXISTS `attock_customers` LIKE `customers`;
CREATE TABLE IF NOT EXISTS `attock_vendors` LIKE `vendors`;
CREATE TABLE IF NOT EXISTS `attock_settings` LIKE `settings`;

SET FOREIGN_KEY_CHECKS = 1;
