import { z } from 'zod'
import { updatePropsSchema } from '../../propsSchema.js'

export function updateGameConfigBodySchema(zod: typeof z) {
  return zod.object({
    props: updatePropsSchema,
  })
}
