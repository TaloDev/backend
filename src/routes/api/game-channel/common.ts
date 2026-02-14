import type { Next } from 'koa'
import { EntityManager } from '@mikro-orm/mysql'
import { APIRouteContext } from '../../../lib/routing/context'
import { PlayerAliasRouteState } from '../../../middleware/player-alias-middleware'
import GameChannel from '../../../entities/game-channel'
import PlayerAlias from '../../../entities/player-alias'

type GameChannelRouteState = PlayerAliasRouteState & {
  channel: GameChannel
}

export async function loadChannel(ctx: APIRouteContext<GameChannelRouteState>, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const channel = await em.repo(GameChannel).findOne({
    id: Number(id),
    game: ctx.state.game
  }, {
    populate: ['members:ref']
  })

  if (!channel) {
    return ctx.throw(404, 'Channel not found')
  }

  ctx.state.channel = channel
  await next()
}

export function canModifyChannel(channel: GameChannel, alias: PlayerAlias) {
  return channel.owner?.id === alias.id
}

export async function joinChannel(
  em: EntityManager,
  wss: APIRouteContext['wss'],
  channel: GameChannel,
  playerAlias: PlayerAlias
) {
  if (!channel.hasMember(playerAlias.id)) {
    channel.members.add(playerAlias)

    await channel.sendMessageToMembers(wss, 'v1.channels.player-joined', {
      channel,
      playerAlias
    })

    await em.flush()
  }
}
