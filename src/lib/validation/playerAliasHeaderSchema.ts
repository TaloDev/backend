import z from 'zod'

export const playerAliasHeaderSchema = z.string({ error: 'x-talo-alias is missing from the request headers' })
  .regex(/^\d+$/, { error: 'x-talo-alias header must be a numeric string' })
  .meta({ description: 'The ID of the player\'s alias' })
