import { EntityManager } from '@mikro-orm/mysql'
import { GameActivityType } from '../../../entities/game-activity'
import GameChannel from '../../../entities/game-channel'
import PlayerAlias from '../../../entities/player-alias'
import User from '../../../entities/user'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { mergeAndSanitiseProps } from '../../../lib/props/sanitiseProps'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { updatePropsSchema } from '../../../lib/validation/propsSchema'
import { loadGame } from '../../../middleware/game-middleware'
import Socket from '../../../socket'
import { loadChannel } from './common'

type UpdateChannelParams = {
  em: EntityManager
  channel: GameChannel
  includeDevData: boolean
  wss: Socket
  forwarded?: boolean
  user?: User
  name?: string
  ownerAliasId?: number | null
  props?: { key: string; value: string | null }[]
  autoCleanup?: boolean
  isPrivate?: boolean
  temporaryMembership?: boolean
}

export async function updateChannelHandler({
  em,
  channel,
  includeDevData,
  wss,
  forwarded,
  user,
  name,
  ownerAliasId,
  props,
  autoCleanup,
  isPrivate,
  temporaryMembership,
}: UpdateChannelParams) {
  const changedProperties: string[] = []

  if (typeof name === 'string' && name.trim().length > 0) {
    channel.name = name.trim()
    changedProperties.push('name')
  }

  if (props) {
    try {
      channel.setProps(
        mergeAndSanitiseProps({ prevProps: channel.props.getItems(), newProps: props }),
      )
    } catch (err) {
      if (err instanceof PropSizeError) {
        return buildErrorResponse({ props: [err.message] })
        /* v8 ignore next 3 */
      }
      throw err
    }
    changedProperties.push('props')
  }

  if (typeof ownerAliasId !== 'undefined') {
    if (ownerAliasId !== null) {
      const newOwner = await em.repo(PlayerAlias).findOne({
        id: ownerAliasId,
        player: { game: channel.game },
      })

      if (!newOwner) {
        return {
          status: 404,
          body: { message: 'New owner not found' },
        }
      }

      if (!channel.hasMember(newOwner.id)) {
        channel.members.add(newOwner)
      }

      channel.owner = newOwner

      await channel.sendMessageToMembers(wss, 'v1.channels.ownership-transferred', {
        channel,
        newOwner,
      })
    } else {
      channel.owner = null
    }

    changedProperties.push('ownerAliasId')
  }

  if (typeof autoCleanup === 'boolean') {
    channel.autoCleanup = autoCleanup
    changedProperties.push('autoCleanup')
  }

  if (typeof isPrivate === 'boolean') {
    channel.private = isPrivate
    changedProperties.push('private')
  }

  if (typeof temporaryMembership === 'boolean') {
    channel.temporaryMembership = temporaryMembership
    changedProperties.push('temporaryMembership')
  }

  if (changedProperties.length > 0) {
    // don't send this message if the only thing that changed is the owner
    // that is covered by the ownership transferred message
    if (!(changedProperties.length === 1 && changedProperties[0] === 'ownerAliasId')) {
      await channel.sendMessageToMembers(wss, 'v1.channels.updated', {
        channel,
        changedProperties,
      })
    }
  }

  if (!forwarded && user) {
    const propertyValues: Record<string, unknown> = {
      name,
      props,
      ownerAliasId,
      autoCleanup,
      private: isPrivate,
      temporaryMembership,
    }

    createGameActivity(em, {
      user,
      game: channel.game,
      type: GameActivityType.GAME_CHANNEL_UPDATED,
      extra: {
        channelName: channel.name,
        display: {
          'Updated properties': changedProperties
            .map((key) => {
              const value = propertyValues[key]
              const property = typeof value === 'object' ? JSON.stringify(value) : value
              return `${key}: ${property}`
            })
            .join(', '),
        },
      },
    })
  }

  await em.flush()

  const counts = await GameChannel.getManyCounts({ em, channelIds: [channel.id], includeDevData })

  return {
    status: 200,
    body: {
      channel: channel.toJSONWithCount(counts),
    },
  }
}

export const updateRoute = protectedRoute({
  method: 'put',
  path: '/:id',
  schema: (z) => ({
    body: z.object({
      name: z.string().optional(),
      ownerAliasId: z.number().nullable().optional(),
      props: updatePropsSchema.optional(),
      autoCleanup: z.boolean().optional(),
      private: z.boolean().optional(),
      temporaryMembership: z.boolean().optional(),
    }),
  }),
  middleware: withMiddleware(loadGame, loadChannel),
  handler: async (ctx) => {
    const {
      name,
      ownerAliasId,
      props,
      autoCleanup,
      private: isPrivate,
      temporaryMembership,
    } = ctx.state.validated.body

    return updateChannelHandler({
      em: ctx.em,
      channel: ctx.state.channel,
      includeDevData: ctx.state.includeDevData,
      wss: ctx.wss,
      user: ctx.state.user,
      name,
      ownerAliasId,
      props,
      autoCleanup,
      isPrivate,
      temporaryMembership,
    })
  },
})
