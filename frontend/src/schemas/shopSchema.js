import { z } from 'zod';

export const shopSchema = z.object({
  name: z.string()
    .min(3, { message: "Shop name must be at least 3 characters" })
    .max(100, { message: "Shop name too long" }),
  address: z.string()
    .min(5, { message: "Address must be at least 5 characters" })
    .max(200, { message: "Address too long" })
    .optional()
    .or(z.literal('')),
  contactNumber: z.string()
    .regex(/^\+?[0-9\s\-()]{1,20}$/, { message: "Invalid phone number format" })
    .optional()
    .or(z.literal('')),
  adminUsername: z.string()
    .email({ message: "Please enter a valid email address" })
    .optional(), // Optional for updates
  adminPassword: z.string()
    .min(6, { message: "Password must be at least 6 characters" })
    .optional(), // Optional for updates
  adminFullName: z.string()
    .min(3, { message: "Full name must be at least 3 characters" })
    .optional(),
  easypaisaNumber: z.string()
    .regex(/^0[0-9]{10}$/, { message: "EasyPaisa number must be 11 digits (e.g. 03001234567)" })
    .optional()
    .or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  bankAccountNumber: z.string().optional().or(z.literal('')),
  bankAccountTitle: z.string().optional().or(z.literal('')),
  banks: z.array(z.object({
    bankName: z.string().optional().or(z.literal('')),
    bankAccountNumber: z.string().optional().or(z.literal('')),
    bankAccountTitle: z.string().optional().or(z.literal(''))
  })).optional()
});

