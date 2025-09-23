import { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from '../config/mikro-orm.config'
import Player from '../entities/player'
import createClickHouseClient from '../lib/clickhouse/createClient'
import { ClickHouseClient } from '@clickhouse/client'
import Game from '../entities/game'
import { subDays } from 'date-fns'
import { captureException } from '@sentry/node'
import createGameActivity from '../lib/logging/createGameActivity'
import { GameActivityType } from '../entities/game-activity'
import User, { UserType } from '../entities/user'
import { streamByCursor } from '../lib/perf/streamByCursor'

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

async function findAndDeleteInactivePlayers(em: EntityManager, clickhouse: ClickHouseClient, game: Game, devBuild: boolean) {
  const shouldPurge = devBuild ? game.purgeDevPlayers : game.purgeLivePlayers
  if (!shouldPurge) {
    return
  }

  try {
    let batch: Player[] = []
    let totalDeleted = 0

    for await (const player of getPlayers(em, game, devBuild)) {
      batch.push(player)
      /* v8 ignore start */
      if (batch.length >= playersBatchSize) {
        await deletePlayers({ em, clickhouse, players: batch, game, devBuild })
        totalDeleted += batch.length
        batch = []
      }
      /* v8 ignore stop */
    }

    // delete any remaining players in the last batch
    if (batch.length > 0) {
      await deletePlayers({ em, clickhouse, players: batch, game, devBuild })
      totalDeleted += batch.length
    }

    if (totalDeleted > 0) {
      console.info(`Deleted ${totalDeleted} inactive${devBuild ? ' dev' : ''} players from game ${game.id}`)
    }
  } catch (err) {
    console.error(`Error deleting inactive${devBuild ? ' dev' : ''} players:`, err)
    captureException(err)
  }
}

export async function deleteClickHousePlayerData(
  clickhouse: ClickHouseClient,
  options: { playerIds: string[], aliasIds: number[], deleteSessions?: boolean }
) {
  const { playerIds, aliasIds, deleteSessions } = options
  const aliasList = aliasIds.join(', ')
  const playerList = playerIds.map((id) => `'${id}'`).join(',')

  const queries: string[] = [
    `DELETE FROM event_props WHERE event_id IN (SELECT id FROM events WHERE player_alias_id in (${aliasList}))`,
    `DELETE FROM events WHERE player_alias_id in (${aliasList})`,
    `DELETE FROM socket_events WHERE player_alias_id in (${aliasList})`
  ]
  if (deleteSessions) {
    queries.push(`DELETE FROM player_sessions WHERE player_id in (${playerList})`)
  }

  await Promise.all(queries.map((query) => clickhouse.exec({ query })))
}

export async function deletePlayers({
  em,
  clickhouse,
  players,
  game,
  devBuild,
  createActivity = true
}: {
  em: EntityManager
  clickhouse: ClickHouseClient
  players: Player[]
  game: Game
  devBuild: boolean
  createActivity?: boolean
}) {
  const playerIds = players.map((player) => player.id)
  const aliasIds = players.flatMap((player) => player.aliases.map((alias) => alias.id))

  const aliases = players.flatMap((player) => player.aliases.getItems())
  const auth = players.flatMap((player) => player.auth).filter((auth) => !!auth)
  const presence = players.flatMap((player) => player.presence).filter((presence) => !!presence)

  await em.transactional(async (trx) => {
    trx.remove([
      ...aliases,
      ...auth,
      ...presence,
      ...players
    ])

    if (createActivity && players.length > 0) {
      createGameActivity(trx, {
        user: await trx.repo(User).findOneOrFail({
          type: UserType.OWNER,
          organisation: game.organisation
        }),
        game,
        type: devBuild
          ? GameActivityType.INACTIVE_DEV_PLAYERS_DELETED
          : GameActivityType.INACTIVE_LIVE_PLAYERS_DELETED,
        extra: {
          count: players.length
        }
      })
    }

    await deleteClickHousePlayerData(clickhouse, { playerIds, aliasIds, deleteSessions: true })
  })
}

export default async function deleteInactivePlayers() {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager
  const clickhouse = createClickHouseClient()

  const games = await em.repo(Game).find({
    $or: [
      { purgeDevPlayers: true },
      { purgeLivePlayers: true }
    ]
  })

  for (const game of games) {
    await Promise.all([true, false].map((devBuild) => {
      return findAndDeleteInactivePlayers(em, clickhouse, game, devBuild)
    }))
  }

  await clickhouse.close()
}
