import { z } from 'zod'
import { RelationshipType } from '../../../entities/player-alias-subscription.js'

export const relationshipTypeSchema = z.enum(RelationshipType, {
  error: 'relationshipType must be either "unidirectional" or "bidirectional"',
})
