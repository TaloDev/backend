import { EntityManager } from '@mikro-orm/mysql'
import type Socket from '../socket/index.js'
import { getMikroORM } from '../config/mikro-orm.config.js'
import { GameActivityType } from '../entities/game-activity.js'
import Game, { MAX_LIVE_CONFIG_VALUE_LENGTH } from '../entities/game.js'
import ScheduledGameConfigChange from '../entities/scheduled-game-config-change.js'
import createGameActivity from '../lib/logging/createGameActivity.js'
import { applyPropsInOrder } from '../lib/props/sanitiseProps.js'
import { getSocketInstance } from '../socket/socketRegistry.js'

// applies a game's due changes in chronological order so that multiple
// changes to the same key settle on the latest one
async function applyGameChanges({
  em,
  socket,
  game,
  changes,
}: {
  em: EntityManager
  socket: Socket | null
  game: Game
  changes: ScheduledGameConfigChange[]
}) {
  const { accepted, applied, rejected } = applyPropsInOrder({
    prevProps: game.props,
    changes,
    valueLimit: MAX_LIVE_CONFIG_VALUE_LENGTH,
  })

  for (const { change, reasons } of rejected) {
    createGameActivity(em, {
      actor: change.createdByUser,
      game,
      type: GameActivityType.GAME_PROPS_SCHEDULED_CHANGE_SKIPPED,
      extra: {
        display: {
          'Skipped prop': `${change.key}: ${change.value ?? '[deleted]'}`,
          Reason: reasons.map((reason) => reason.message).join(', '),
        },
      },
    })

    console.warn(
      `Skipping scheduled game config change ${change.id}: ${reasons.map((r) => r.message).join(', ')}`,
    )
  }

  if (applied.length > 0) {
    game.props = accepted

    for (const change of applied) {
      createGameActivity(em, {
        actor: change.createdByUser,
        game,
        type: GameActivityType.GAME_PROPS_UPDATED,
        extra: {
          display: {
            'Updated props': `${change.key}: ${change.value ?? '[deleted]'}`,
          },
        },
      })
    }
  }

  await em.remove(changes).flush()

  if (applied.length === 0) {
    return
  }

  await em.clearCache(Game.getLiveConfigCacheKey(game))

  /* v8 ignore next 3 -- @preserve */
  if (socket) {
    game.notifyLiveConfigUpdated(socket)
  }
}

export async function applyScheduledGameConfigChanges() {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager
  const socket = getSocketInstance()

  const due = await em
    .repo(ScheduledGameConfigChange)
    .find(
      { applyAt: { $lte: new Date() } },
      { orderBy: { applyAt: 'asc', id: 'asc' }, populate: ['game', 'createdByUser'] },
    )

  if (due.length === 0) {
    return
  }

  const changesByGame = new Map<number, ScheduledGameConfigChange[]>()
  for (const change of due) {
    const changes = changesByGame.get(change.game.id) ?? []
    changes.push(change)
    changesByGame.set(change.game.id, changes)
  }

  for (const changes of changesByGame.values()) {
    await applyGameChanges({ em, socket, game: changes[0].game, changes })
  }
}
