import { z } from "zod";
import { cuidSchema } from "./primitives.js";

// Email schema - trim, lowercase, validate format
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export type Email = z.infer<typeof emailSchema>;

// Password schema
// Why 12-char minimum beats character-class rules: Length matters more than
// complexity. A 12-character passphrase of common words ("coffee table morning sun")
// has far more entropy than an 8-character password with mixed case, digits, and
// symbols. Requiring at least one letter and one non-letter prevents purely
// alphabetic or purely numeric passwords while avoiding the UX nightmare of
// "must have uppercase, lowercase, digit, and special character" rules.
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(200)
  .refine(
    (password) => {
      const hasLetter = /[a-zA-Z]/.test(password);
      const hasNonLetter = /[^a-zA-Z]/.test(password);
      return hasLetter && hasNonLetter;
    },
    {
      message: "Password must contain at least one letter and one non-letter",
    },
  );

export type Password = z.infer<typeof passwordSchema>;

// Signup schema
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type Signup = z.infer<typeof signupSchema>;

// Login schema
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type Login = z.infer<typeof loginSchema>;

// Public user schema - safe to send to client
// IMPORTANT: passwordHash must NEVER appear in any response type sent to the client
export const publicUserSchema = z.object({
  id: cuidSchema,
  email: emailSchema,
  createdAt: z.string().datetime(),
});

export type PublicUser = z.infer<typeof publicUserSchema>;
