import { z } from 'zod'
import { updatePropsSchema } from '../../../lib/validation/propsSchema.js'
import { optionalChannelFields } from './optionalChannelFields.js'

export function updateChannelBodySchema(zod: typeof z) {
  return zod.object({
    name: zod.string().optional().meta({ description: 'The new name of the channel' }),
    ...optionalChannelFields(zod),
    props: updatePropsSchema.optional().meta({ description: 'An array of @type(Props:prop)' }),
  })
}
