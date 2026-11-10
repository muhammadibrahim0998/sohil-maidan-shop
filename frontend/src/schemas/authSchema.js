import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string()
    .min(3, { message: "Please enter your username or email" }),
  password: z.string(),
});
