import { z } from 'zod';

export const settingsSchema = z.object({
  shopName: z.string()
    .min(3, { message: "Shop name must be at least 3 characters" })
    .max(100),
  address: z.string()
    .min(5, { message: "Address must be at least 5 characters" })
    .optional()
    .or(z.literal('')),
  phone: z.string()
    .regex(/^\+?[0-9\s\-()]{1,20}$/, { message: "Invalid phone number format" })
    .optional()
    .or(z.literal('')),
  email: z.string()
    .email({ message: "Invalid email address" })
    .optional()
    .or(z.literal('')),
  currency: z.string()
    .min(1)
    .max(5)
    .default('$'),
  taxRate: z.coerce.number()
    .nonnegative()
    .max(100)
    .default(0),
  ownerPassword: z.string()
    .optional()
    .or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
  ownerFullName: z.string().optional().or(z.literal('')),
  ownerEmail: z.string().email({ message: "Invalid email" }).optional().or(z.literal('')),
  ownerPhone: z.string().optional().or(z.literal('')),
  easypaisaNumber: z.string()
    .regex(/^0[0-9]{10}$/, { message: "EasyPaisa number must be 11 digits (e.g. 03001234567)" })
    .optional()
    .or(z.literal('')),
  easypaisaEnabled: z.boolean().optional(),
});
