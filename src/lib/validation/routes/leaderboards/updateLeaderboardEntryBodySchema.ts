import z from 'zod'

export const updateLeaderboardEntryBodySchema = z.object({
  hidden: z.boolean().optional().meta({ description: 'Whether the entry is hidden' }),
  newScore: z.number().optional().meta({ description: 'The new score for the entry' }),
})
