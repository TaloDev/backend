import z from 'zod'
import { numericStringSchema } from '../../numericStringSchema.js'
import { pageSchema } from '../../pageSchema.js'

export const entriesQuerySchema = z.object({
  page: pageSchema.meta({ description: 'The current pagination index (starting at 0)' }),
  aliasId: numericStringSchema
    .optional()
    .meta({ description: 'Only return entries for this alias ID' }),
  withDeleted: z
    .enum(['0', '1'])
    .optional()
    .transform((val) => val === '1')
    .meta({ description: 'Include entries that were deleted by a refresh interval' }),
  propKey: z.string().optional().meta({ description: 'Only return entries with this prop key' }),
  propValue: z
    .string()
    .optional()
    .meta({ description: 'Only return entries with a matching prop key and value' }),
  startDate: z.string().optional().meta({
    description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
  }),
  endDate: z.string().optional().meta({
    description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
  }),
  aliasService: z.string().optional().meta({
    description: 'Only return entries for this player alias service (e.g. steam, epic, username)',
  }),
  playerId: z.uuid().optional().meta({
    description: 'Only return entries for this player ID',
  }),
})
