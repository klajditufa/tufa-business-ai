import { z } from "zod";

/**
 * Variablat e ambientit, të validuara në start.
 * Vetëm NEXT_PUBLIC_* arrijnë në browser; SUPABASE_SERVICE_ROLE_KEY nuk përdoret kurrë në Fazën 1 nga app-i web.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  NEXT_PUBLIC_APP_NAME: z.string().default("TUFA Business AI"),
});

export const env = schema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});
