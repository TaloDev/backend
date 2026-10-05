import { EntityManager } from '@mikro-orm/mysql'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { GameActivityType } from '../../../entities/game-activity.js'
import GameChannel from '../../../entities/game-channel.js'
import Game from '../../../entities/game.js'
import PlayerAlias from '../../../entities/player-alias.js'
import User from '../../../entities/user.js'
import { buildErrorResponse } from '../../../lib/errors/buildErrorResponse.js'
import { PropRejectionError } from '../../../lib/errors/propRejectionError.js'
import createGameActivity from '../../../lib/logging/createGameActivity.js'
import { filterProfaneProps } from '../../../lib/props/filterProfaneProps.js'
import { hardSanitiseProps } from '../../../lib/props/sanitiseProps.js'
import { protectedRoute, withMiddleware } from '../../../lib/routing/router.js'
import { loadGame } from '../../../middleware/game-middleware.js'
import Socket from '../../../socket/index.js'
import { createChannelBodySchema } from '../../schemas/game-channels/createChannelBodySchema.js'

type CreateChannelParams = {
  em: EntityManager
  game: Game
  includeDevData: boolean
  wss: Socket
  forwarded?: boolean
  actor?: User | AdminAPIKey
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
  actor,
  alias,
  name,
  ownerAliasId,
  props,
  autoCleanup,
  isPrivate,
  temporaryMembership,
}: CreateChannelParams) {
  try {
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
      const { accepted: sizeAccepted, rejected: sizeRejected } = hardSanitiseProps({ props })

      if (game.blockPropsProfanity) {
        const { accepted, rejected: profanityRejected } = filterProfaneProps(sizeAccepted, true)
        const allRejected = [...sizeRejected, ...profanityRejected]
        if (allRejected.length > 0) {
          throw new PropRejectionError(allRejected)
        }
        channel.setProps(accepted)
      } else {
        if (sizeRejected.length > 0) {
          throw new PropRejectionError(sizeRejected)
        }
        channel.setProps(sizeAccepted)
      }
    }

    if (!forwarded && actor) {
      createGameActivity(em, {
        actor,
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
  } catch (err) {
    if (err instanceof PropRejectionError) {
      return buildErrorResponse({ props: [err.message] }, { rejectedProps: err.rejected })
    }
    throw err
  }
}

export const createRoute = protectedRoute({
  method: 'post',
  schema: (z) => ({
    body: createChannelBodySchema(z),
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
      actor: ctx.state.user,
      name,
      ownerAliasId,
      props,
      autoCleanup,
      isPrivate,
      temporaryMembership,
    })
  },
})
