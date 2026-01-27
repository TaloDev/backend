import { z } from 'zod'

export const pageSchema = z.coerce.number().int().min(0).default(0)
