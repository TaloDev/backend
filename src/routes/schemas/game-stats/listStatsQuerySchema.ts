import z from 'zod'

export const listStatsQuerySchema = z.object({
  withMetrics: z
    .string()
    .optional()
    .meta({ description: 'Set to 1 to include metrics for global stats' }),
  metricsStartDate: z.string().optional().meta({
    description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
  }),
  metricsEndDate: z.string().optional().meta({
    description: 'A UTC Date (YYYY-MM-DD), DateTime (ISO 8601) or millisecond timestamp',
  }),
})
