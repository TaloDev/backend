import type { Next } from 'koa'
import { APIRouteContext } from '../../../lib/routing/context'
import { PlayerRouteState } from '../../../middleware/player-middleware'
import GameSave from '../../../entities/game-save'

export type GameSaveRouteState = PlayerRouteState & {
  save: GameSave
}

export const loadSave = async (ctx: APIRouteContext<GameSaveRouteState>, next: Next) => {
  const { id } = ctx.params

  const save = await ctx.em.repo(GameSave).findOne({
    id: Number(id),
    player: ctx.state.player
  })

  if (!save) {
    ctx.throw(404, 'Save not found')
  }

  ctx.state.save = save

  await next()
}

export function decodeContent(content: unknown) {
  return typeof content === 'string' ? JSON.parse(content) : content
}
