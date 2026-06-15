import { z } from 'zod'

const emailFormatSchema = z.email()

export function isEmailValid(email: string) {
  const result = emailFormatSchema.safeParse(email)
  return result.success
}
