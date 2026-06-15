import { z } from 'zod'

const emailFormatSchema = z.string().email()

export function isEmailValid(email: string) {
  const result = emailFormatSchema.safeParse(email)
  return result.success
}
