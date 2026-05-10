import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { GameActivityType } from '../../../entities/game-activity.js'
import GameChannel from '../../../entities/game-channel.js'
import Game from '../../../entities/game.js'
import PlayerAlias from '../../../entities/player-alias.js'
import User from '../../../entities/user.js'
import buildErrorResponse from '../../../lib/errors/buildErrorResponse.js'
import { PropSizeError } from '../../../lib/errors/propSizeError.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { hardSanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { createPropsSchema } from '../../../lib/validation/propsSchema.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import Socket from '../../../socket/index.js'

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
  props?: { key: string; value: string }[]
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
  temporaryMembership,
}: CreateChannelParams) {
  const channel = new GameChannel(game)
  channel.name = name
  channel.autoCleanup = autoCleanup ?? false
  channel.private = isPrivate ?? false
  channel.temporaryMembership = temporaryMembership ?? false

  if (ownerAliasId) {
    const owner = await em.repo(PlayerAlias).findOne({
      id: ownerAliasId,
      player: { game },
    })

    if (!owner) {
      return {
        status: 404,
        body: { message: 'Owner not found' },
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
        channelName: channel.name,
      },
    })
  }

  await em.persist(channel).flush()

  await channel.sendMessageToMembers(wss, 'v1.channels.player-joined', {
    channel,
    playerAlias: alias,
  })

  const counts = await GameChannel.getManyCounts({ em, channelIds: [channel.id], includeDevData })

  return {
    status: 200,
    body: {
      channel: channel.toJSONWithCount(counts),
    },
  }
}

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: z.object({
      name: z.string(),
      ownerAliasId: z.number().nullish(),
      props: createPropsSchema.optional(),
      autoCleanup: z.boolean().optional(),
      private: z.boolean().optional(),
      temporaryMembership: z.boolean().optional(),
    }),
  }),
  middleware: withMiddleware(loadGame),
  handler: async (ctx) => {
    const {
      name,
      ownerAliasId,
      props,
      autoCleanup,
      private: isPrivate,
      temporaryMembership,
    } = ctx.state.validated.body

    return createChannelHandler({
      em: ctx.em,
      game: ctx.state.game,
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
