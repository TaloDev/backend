import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router'
import { loadGame } from '../../../middleware/game-middleware'
import GameChannel from '../../../entities/game-channel'
import Game from '../../../entities/game'
import PlayerAlias from '../../../entities/player-alias'
import User from '../../../entities/user'
import { GameActivityType } from '../../../entities/game-activity'
import createGameActivity from '../../../lib/logging/createGameActivity'
import { hardSanitiseProps } from '../../../lib/props/sanitiseProps'
import { PropSizeError } from '../../../lib/errors/propSizeError'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse'
import Socket from '../../../socket'

type CreateChannelParams = {
  em: EntityManager
  game: Game
  includeDevData: boolean
  wss: Socket
  forwarded?: boolean
  user?: User
  alias?: PlayerAlias
  name: string
  ownerAliasId?: number | null
  props?: { key: string, value: string }[]
  autoCleanup?: boolean
  isPrivate?: boolean
  temporaryMembership?: boolean
}

export async function createChannelHandler({
  em,
  game,
  includeDevData,
  wss,
  forwarded,
  user,
  alias,
  name,
  ownerAliasId,
  props,
  autoCleanup,
  isPrivate,
  temporaryMembership
}: CreateChannelParams) {
  const channel = new GameChannel(game)
  channel.name = name
  channel.autoCleanup = autoCleanup ?? false
  channel.private = isPrivate ?? false
  channel.temporaryMembership = temporaryMembership ?? false

  if (ownerAliasId) {
    const owner = await em.repo(PlayerAlias).findOne({
      id: ownerAliasId,
      player: { game }
    })

    if (!owner) {
      return {
        status: 404,
        body: { message: 'Owner not found' }
      }
    }

    channel.owner = owner
    channel.members.add(owner)
  } else if (alias) {
    channel.owner = alias
    channel.members.add(alias)
  }

  if (props) {
    try {
      channel.setProps(hardSanitiseProps({ props }))
    } catch (err) {
      if (!(err instanceof PropSizeError)) {
        captureException(err)
      }
      return buildErrorResponse({ props: [(err as Error).message] })
    }
  }

  if (!forwarded && user) {
    createGameActivity(em, {
      user,
      game,
      type: GameActivityType.GAME_CHANNEL_CREATED,
      extra: {
        channelName: channel.name
      }
    })
  }

  await em.persist(channel).flush()

  await channel.sendMessageToMembers(wss, 'v1.channels.player-joined', {
    channel,
    playerAlias: alias
  })

  return {
    status: 200,
    body: {
      channel: await channel.toJSONWithCount(includeDevData)
    }
  }
}

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      name: z.string(),
      ownerAliasId: z.number().nullish(),
      props: z.array(z.object({
        key: z.string(),
        value: z.string()
      })).optional(),
      autoCleanup: z.boolean().optional(),
      private: z.boolean().optional(),
      temporaryMembership: z.boolean().optional()
    })
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const { name, ownerAliasId, props, autoCleanup, private: isPrivate, temporaryMembership } = ctx.state.validated.body

    return createChannelHandler({
      em: ctx.em,
      game: ctx.state.game,
      includeDevData: ctx.state.includeDevData,
      wss: ctx.wss,
      user: ctx.state.authenticatedUser,
      name,
      ownerAliasId,
      props,
      autoCleanup,
      isPrivate,
      temporaryMembership
    })
  }
})
