import z from 'zod'

export const sessionHeaderSchema = z.string({
  error: 'x-talo-session header is required'
}).meta({
  description: 'The session token'
})
