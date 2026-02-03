import z from 'zod'

export const playerAliasHeaderSchema = z.string().regex(/^\d+$/, {
  error: 'x-talo-alias header must be a numeric string'
}).meta({
  description: 'The ID of the player\'s alias'
})
