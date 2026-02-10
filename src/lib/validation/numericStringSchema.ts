import z from 'zod'

export const numericStringSchema = z.coerce.number().int()
