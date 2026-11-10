import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  category: z.string().optional().or(z.literal('')),
  price: z.coerce.number().min(0, { message: "Price cannot be negative" }).optional().default(0),
  costPrice: z.coerce.number().optional(),
  stock: z.coerce.number().optional(),
  minStock: z.coerce.number().optional(),
  description: z.string().optional().or(z.literal('')),
  images: z.array(z.string()).optional(),
  mfgDate: z.any().optional(),
  expiryDate: z.any().optional(),
  // Egg Units & Ratios
  unitType: z.string().optional(),
  traysPerPeti: z.coerce.number().optional(),
  eggsPerTray: z.coerce.number().optional(),
  petiQuantity: z.coerce.number().optional(),
  trayQuantity: z.coerce.number().optional(),
  eggQuantity: z.coerce.number().optional(),
  // Supplier & Payments
  supplierName: z.string().optional().or(z.literal('')),
  supplierPhone: z.string().optional().or(z.literal('')),
  supplierLocation: z.string().optional().or(z.literal('')),
  totalPurchaseCost: z.coerce.number().optional(),
  amountPaidToSupplier: z.coerce.number().optional(),
  dueAmountToSupplier: z.coerce.number().optional(),
  paymentMethod: z.string().optional(),
  paymentReceipt: z.string().optional().or(z.literal('')),
  isOnlinePayment: z.boolean().optional(),
  // Explicit Unit Rates
  pricePerPeti: z.coerce.number().optional(),
  pricePerTray: z.coerce.number().optional(),
  pricePerEgg: z.coerce.number().optional(),
});
