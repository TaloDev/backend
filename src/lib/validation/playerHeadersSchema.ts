import z from 'zod'
import { CLAIM_KEY_HEADER } from '../auth/claim-key.js'

export const playerHeaderSchema = z
  .uuid({
    error: 'x-talo-player header must be a valid player ID',
  })
  .meta({
    description: 'The ID of the player',
  })

export const playerAliasHeaderSchema = z
  .string({ error: 'x-talo-alias is missing from the request headers' })
  .regex(/^\d+$/, { error: 'x-talo-alias header must be a numeric string' })
  .meta({ description: "The ID of the player's alias" })

export const claimKeyHeaderSchema = z
  .string()
  .min(1, { error: `${CLAIM_KEY_HEADER} must be a non-empty string` })
  .max(255, { error: `${CLAIM_KEY_HEADER} must be 255 characters or fewer` })
  .optional()
  .meta({
    description: "The player's claim key, required if they have one",
  })

const claimKeyField = {
  [CLAIM_KEY_HEADER]: claimKeyHeaderSchema,
}

export const claimKeyHeaders = z.looseObject(claimKeyField)

export const playerAliasHeaders = z.looseObject({
  'x-talo-alias': playerAliasHeaderSchema,
  ...claimKeyField,
})

export const playerHeaders = z.looseObject({
  'x-talo-player': playerHeaderSchema,
  ...claimKeyField,
})
