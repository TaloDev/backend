import { z } from 'zod'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'

export function updateGameConfigBodySchema(zod: typeof z) {
  return zod.object({
    props: updatePropsSchema,
  })
}
