import { Next } from 'koa'
import { APIRouteContext } from '../../../lib/routing/context'
import PlayerGroup from '../../../entities/player-group'
import { APIRouteState } from '../../../lib/routing/state'

type PlayerGroupRouteState = APIRouteState & {
  group: PlayerGroup
}

export const loadGroup = async (ctx: APIRouteContext<PlayerGroupRouteState>, next: Next) => {
  const { id } = ctx.params

  const group = await ctx.em.getRepository(PlayerGroup).findOne({
    id,
    game: ctx.state.key.game
  })

  if (!group) {
    return ctx.throw(404, 'Group not found')
  }

  ctx.state.group = group
  await next()
}
