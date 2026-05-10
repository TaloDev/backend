import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../entities/organisation.js'
import Player from '../../entities/player.js'
import { getResultCacheOptions } from '../perf/getResultCacheOptions.js'

export default async function getBillablePlayerCount(
  em: EntityManager,
  organisation: Organisation,
): Promise<number> {
  return em.repo(Player).count(
    {
      game: { organisation },
    },
    getResultCacheOptions(`billable-player-count-${organisation.id}`),
  )
}
