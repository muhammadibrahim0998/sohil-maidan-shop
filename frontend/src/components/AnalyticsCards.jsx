import React from 'react';
import { Package, TrendingUp, AlertTriangle, Box, Users, ShoppingBag } from 'lucide-react';
import { StatCard } from './ui/StatCard';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function AnalyticsCards({ 
  totalProducts = 0, 
  totalValue = 0, 
  lowStockProducts = [], 
  outOfStockProducts = [],
  totalStockUnits = 0,
  totalCustomers = 0,
  totalSalesCount = 0,
  totalPetis = 0,
  totalPurchaseCost = 0,
  cashPaidToSupplier = 0,
  onlinePaidToSupplier = 0,
  dueToSupplier = 0
}) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch"
    >
      <motion.div variants={itemVariants}>
        <StatCard
          title="Total Petis (Boxes)"
          value={`${(totalPetis || 0).toLocaleString('en-PK')} Petis`}
          icon={Box}
          color="orange"
          sub={`${totalProducts} Egg Products`}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <StatCard
          title="Available Stock"
          value={`${(totalStockUnits || 0).toLocaleString('en-PK')} Eggs`}
          icon={Package}
          color="green"
          sub={`Total Egg Count`}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <StatCard
          title="Total Sales"
          value={`${totalSalesCount} Sales`}
          icon={ShoppingBag}
          color="blue"
          sub="Total Orders Completed"
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <StatCard
          title="Inventory Value"
          value={`Rs. ${totalValue ? totalValue.toLocaleString() : 0}`}
          icon={TrendingUp}
          color="blue"
          sub="Total Sale Valuation"
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <StatCard
          title="Low Stock"
          value={lowStockProducts.length}
          icon={AlertTriangle}
          color="yellow"
          sub={lowStockProducts.length > 0 ? `${lowStockProducts.length} items low` : "Stock Healthy"}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <StatCard
          title="Out of Stock"
          value={outOfStockProducts.length}
          icon={Box}
          color="red"
          sub={outOfStockProducts.length > 0 ? "Restock Needed" : "All Products In Stock"}
        />
      </motion.div>
    </motion.div>
  );
}