import z from 'zod'

export const playerHeaderSchema = z.uuid({
  error: 'x-talo-player header must be a valid player ID'
}).meta({
  description: 'The ID of the player'
})
