import { z } from 'zod';

export const memberSchema = z.object({
  fullName: z.string()
    .min(2, { message: "Legal Identity requires at least 2 characters" })
    .max(100, { message: "Name exceeds protocol limit" }),
  
  username: z.string()
    .min(3, { message: "System handle requires at least 3 characters" })
    .max(100, { message: "System handle exceeds protocol limit" }),
  
  password: z.string()
    .optional()
    .or(z.literal('')),
  
  role: z.enum(['super_admin', 'shop_admin', 'admin', 'cashier', 'salesman', 'owner'], {
    errorMap: () => ({ message: "Select a valid authorization tier" })
  }),
  
  status: z.enum(['active', 'inactive']).optional(),

  preferredShift: z.enum(['day', 'night', 'both'], {
    errorMap: () => ({ message: "Select a valid operational rotation" })
  }).optional(),

  shopId: z.union([z.number(), z.string(), z.null()]).optional(),

  phoneNumber: z.string()
    .optional()
    .or(z.literal(''))
});

export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
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
