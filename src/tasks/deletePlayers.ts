import { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from '../config/mikro-orm.config'
import { PlayerToDelete } from '../entities/player-to-delete'
import Player from '../entities/player'
import { getGlobalQueue } from '../config/global-queues'
import { captureException } from '@sentry/node'
import { DeleteClickHousePlayerDataConfig } from '../lib/queues/createDeleteClickHousePlayerDataQueue'

export async function deleteClickHousePlayerData(
  options: DeleteClickHousePlayerDataConfig
) {
  const queue = getGlobalQueue('delete-clickhouse-player-data')
  await queue.add('delete-clickhouse-player-data', options, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000
    }
  })
}

export async function deletePlayersFromDB(em: EntityManager, players: Player[]) {
  const playerIds = players.map((player) => player.id)
  const aliasIds = players.flatMap((player) => player.aliases.map((alias) => alias.id))

  await em.transactional(async (trx) => {
    await trx.remove(players)
    await deleteClickHousePlayerData({ playerIds, aliasIds })
  })
}

export default async function deletePlayers() {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const playersToDelete = await em.repo(PlayerToDelete).findAll({
    limit: 100,
    populate: ['player', 'player.aliases:ref']
  })

  const count = playersToDelete.length
  if (count === 0) {
    return
  }

  console.info(`Found ${count} players to delete`)

  try {
    await deletePlayersFromDB(em, playersToDelete.map((ptd) => ptd.player))
    console.info(`Deleted ${count} players`)
  } catch (err) {
    console.error('Failed to delete players', err)
    captureException(err)
  }
}
