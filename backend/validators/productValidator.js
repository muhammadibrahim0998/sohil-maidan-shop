import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).optional(),
  category: z.string().optional(),
  price: z.coerce.number().optional(),
  costPrice: z.coerce.number().optional(),
  stock: z.coerce.number().optional(),
  minStock: z.coerce.number().optional(),
  description: z.string().optional().nullable().or(z.literal('')),
  images: z.array(z.string()).optional(),
  mfgDate: z.any().optional(),
  expiryDate: z.any().optional(),
}).passthrough();

export const validateProduct = (req, res, next) => {
  try {
    productSchema.parse(req.body);
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
