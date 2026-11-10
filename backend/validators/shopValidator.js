import { z } from 'zod';

export const shopSchema = z.object({
  name: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  contactNumber: z.string().optional().or(z.literal('')),
  adminUsername: z.string().optional().or(z.literal('')),
  adminPassword: z.string().optional().or(z.literal('')),
  adminFullName: z.string().optional().or(z.literal('')),
  adminEmail: z.string().optional().or(z.literal('')),
  adminPhone: z.string().optional().or(z.literal('')),
  logoUrl: z.string().optional().or(z.literal('')),
  status: z.string().optional(),
  ownerEmail: z.string().optional().or(z.literal('')),
  easypaisaNumber: z.string().optional().or(z.literal('')),
  bankName: z.string().optional().or(z.literal('')),
  bankAccountNumber: z.string().optional().or(z.literal('')),
  bankAccountTitle: z.string().optional().or(z.literal('')),
  banks: z.any().optional(),
  banksJson: z.any().optional(),
  isEditApproved: z.any().optional(),
  isDeleteApproved: z.any().optional(),
  approvalStatus: z.string().optional(),
  approvalNotes: z.string().optional(),
  allowedPages: z.any().optional()
}).passthrough();

export const validateShop = (req, res, next) => {
  try {
    shopSchema.parse(req.body);
    next();
  } catch (error) {
    if (error && error.name === 'ZodError') {
      return res.status(400).json({ 
        message: "Validation Error", 
        errors: (error.errors || error.issues || []).map(err => ({
          field: err.path && err.path[0] ? err.path[0] : 'unknown',
          message: err.message
        }))
      });
    }
    next(error);
  }
};
