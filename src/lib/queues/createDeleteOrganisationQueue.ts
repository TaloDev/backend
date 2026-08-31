import { EntityManager } from '@mikro-orm/mysql'
import { getMikroORM } from '../../config/mikro-orm.config.js'
import Organisation from '../../entities/organisation.js'
import Player from '../../entities/player.js'
import { streamByCursorPages } from '../perf/streamByCursor.js'
import { queuePlayersForDeletion } from '../players/queuePlayersForDeletion.js'
import createQueue from './createQueue.js'

export type DeleteOrganisationConfig = { organisationId: number }

async function queueGamePlayersForDeletion(em: EntityManager, gameId: number) {
  const pages = streamByCursorPages(async (batchSize, after) => {
    return em.repo(Player).findByCursor({
      where: { game: gameId },
      first: batchSize,
      after,
      orderBy: { id: 'asc' },
    })
  })

  for await (const players of pages) {
    await queuePlayersForDeletion(em, players)
    em.clear()
  }
}

async function deleteOrganisationPlayers(organisationId: number) {
  const orm = await getMikroORM()
  const em = orm.em.fork() as EntityManager

  const org = await em
    .repo(Organisation)
    .findOneOrFail({ id: organisationId }, { filters: false, populate: ['games'] })

  const gameIds = org.games.getItems().map((game) => game.id)

  for (const gameId of gameIds) {
    await queueGamePlayersForDeletion(em, gameId)
  }
}

export function createDeleteOrganisationQueue() {
  return createQueue<DeleteOrganisationConfig>('delete-organisation', async (job) => {
    await deleteOrganisationPlayers(job.data.organisationId)
  })
}
