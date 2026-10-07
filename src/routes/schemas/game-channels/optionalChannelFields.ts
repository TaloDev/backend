import { z } from 'zod'

export function optionalChannelFields(zod: typeof z) {
  return {
    ownerAliasId: zod
      .number()
      .nullish()
      .meta({ description: 'The ID of the new owner of the channel' }),
    autoCleanup: zod.boolean().optional().meta({
      description:
        'Whether the channel should be automatically deleted when the owner leaves or the channel is empty (default is false)',
    }),
    private: zod
      .boolean()
      .optional()
      .meta({ description: 'Private channels require invites to join them (default is false)' }),
    temporaryMembership: zod.boolean().optional().meta({
      description: 'Whether members should be removed when they disconnect (default is false)',
    }),
  }
}
