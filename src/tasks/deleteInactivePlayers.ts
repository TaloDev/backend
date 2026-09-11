import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
import { subDays } from 'date-fns'
import { getMikroORM } from '../config/mikro-orm.config.js'
import { GameActivityType } from '../entities/game-activity.js'
import Game from '../entities/game.js'
import Player from '../entities/player.js'
import User, { UserType } from '../entities/user.js'
import createGameActivity from '../lib/logging/createGameActivity.js'
import { streamByCursorPages } from '../lib/perf/streamByCursor.js'
import { queuePlayersForDeletion } from '../lib/players/queuePlayersForDeletion.js'

function getPlayers(em: EntityManager, game: Game, devBuild: boolean) {
  const days = devBuild ? game.purgeDevPlayersRetention : game.purgeLivePlayersRetention

  return streamByCursorPages(async (batchSize, after) => {
    return em.repo(Player).findByCursor({
      where: {
        game,
        devBuild,
        lastSeenAt: {
          $lt: subDays(new Date(), days),
        },
      },
      first: batchSize,
      after,
      orderBy: { id: 'asc' },
      populate: ['aliases', 'auth'],
      includeCount: false,
    })
  }, 100)
}

async function createPurgeActivity({
  em,
  game,
  devBuild,
  count,
}: {
  em: EntityManager
  game: Game
  devBuild: boolean
  count: number
}) {
  createGameActivity(em, {
    actor: await em.repo(User).findOneOrFail(
      {
        type: UserType.OWNER,
        organisation: game.organisation,
      },
      { filters: false },
    ),
    game,
    type: devBuild
      ? GameActivityType.INACTIVE_DEV_PLAYERS_DELETED
      : GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
    extra: {
      count,
    },
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
    let totalQueued = 0

    for await (const players of getPlayers(em, game, devBuild)) {
      const queued = await queuePlayersForDeletion(em, players)
      totalQueued += queued
    }

    if (totalQueued > 0) {
      console.info(
        `Queued ${totalQueued} inactive${devBuild ? ' dev' : ''} players for deletion from game ${game.id}`,
      )
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

  const games = await em.repo(Game).find(
    {
      $or: [{ purgeDevPlayers: true }, { purgeLivePlayers: true }],
    },
    { populate: ['organisation'], filters: false },
  )

  for (const game of games) {
    await findAndQueueInactivePlayers(em.fork(), game, true)
    await findAndQueueInactivePlayers(em.fork(), game, false)
  }
}
