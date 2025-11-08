import { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from '../config/mikro-orm.config'
import Player from '../entities/player'
import Game from '../entities/game'
import { subDays } from 'date-fns'
import { captureException } from '@sentry/node'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import User, { UserType } from '../entities/user'
import { streamByCursor } from '../lib/perf/streamByCursor'
import { PlayerToDelete } from '../entities/player-to-delete'

const playersBatchSize = 100

function getPlayers(em: EntityManager, game: Game, devBuild: boolean) {
  const days = devBuild ? game.purgeDevPlayersRetention : game.purgeLivePlayersRetention

  return streamByCursor<Player>(async (batchSize, after) => {
    return em.repo(Player).findByCursor({
      game,
      devBuild,
      lastSeenAt: {
        $lt: subDays(new Date(), days)
      }
    }, {
      first: batchSize,
      after,
      orderBy: { id: 'asc' },
      populate: ['aliases', 'auth'] as const
    })
  }, playersBatchSize)
}

async function createPurgeActivity({
  em,
  game,
  devBuild,
  count
}: {
  em: EntityManager
  game: Game
  devBuild: boolean
  count: number
}) {
  createGameActivity(em, {
    user: await em.repo(User).findOneOrFail({
      type: UserType.OWNER,
      organisation: game.organisation
    }),
    game,
    type: devBuild
      ? GameActivityType.INACTIVE_DEV_PLAYERS_DELETED
      : GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
    extra: {
      count
    }
  })
  await em.flush()
}

async function findAndQueueInactivePlayers(em: EntityManager, game: Game, devBuild: boolean) {
  const shouldPurge = devBuild ? game.purgeDevPlayers : game.purgeLivePlayers
  if (!shouldPurge) {
    return
  }

  console.info(`Queueing ${devBuild ? 'dev' : 'live'} players for deletion for game ${game.id}`)

  try {
    let batch: Player[] = []
    let totalQueued = 0

    for await (const player of getPlayers(em, game, devBuild)) {
      batch.push(player)
      /* v8 ignore start */
      if (batch.length >= playersBatchSize) {
        const playersToDelete = batch.map((player) => new PlayerToDelete(player))
        await em.persistAndFlush(playersToDelete)
        totalQueued += batch.length
        batch = []
      }
      /* v8 ignore stop */
    }

    // Queue any remaining players in the last batch
    if (batch.length > 0) {
      const playersToDelete = batch.map((player) => new PlayerToDelete(player))
      await em.persistAndFlush(playersToDelete)
      totalQueued += batch.length
    }

    if (totalQueued > 0) {
      console.info(`Queued ${totalQueued} inactive${devBuild ? ' dev' : ''} players for deletion from game ${game.id}`)
      await createPurgeActivity({ em, game, devBuild, count: totalQueued })
    }
  } catch (err) {
    console.error(`Error queueing inactive${devBuild ? ' dev' : ''} players for deletion:`, err)
    captureException(err)
  }
}

export default async function deleteInactivePlayers() {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const games = await em.repo(Game).find({
    $or: [
      { purgeDevPlayers: true },
      { purgeLivePlayers: true }
    ]
  })

  for (const game of games) {
    await findAndQueueInactivePlayers(em.fork(), game, true)
    await findAndQueueInactivePlayers(em.fork(), game, false)
  }
}
