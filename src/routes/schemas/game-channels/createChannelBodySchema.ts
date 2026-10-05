import { z } from 'zod'
import { createPropsSchema } from '../../../lib/validation/propsSchema.js'
import { optionalChannelFields } from './optionalChannelFields.js'

export function createChannelBodySchema(zod: typeof z) {
  return zod.object({
    name: zod.string().meta({ description: 'The name of the channel' }),
    ...optionalChannelFields(zod),
    props: createPropsSchema.optional().meta({ description: 'An array of @type(Props:prop)' }),
  })
}
