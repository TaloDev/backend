import { EntityManager } from '@mikro-orm/mysql'
import { addMonths, startOfMonth } from 'date-fns'
import DeletedPlayer from '../../entities/deleted-player.js'
import Organisation from '../../entities/organisation.js'
import Player from '../../entities/player.js'
import { getResultCacheOptions } from '../perf/getResultCacheOptions.js'

export async function getPlayerUsageBreakdown(em: EntityManager, organisation: Organisation) {
  const monthStart = startOfMonth(new Date())
  const nextMonthStart = startOfMonth(addMonths(new Date(), 1))

  const [live, dev, deleted] = await Promise.all([
    em
      .repo(Player)
      .count(
        { game: { organisation }, devBuild: false },
        getResultCacheOptions(`player-usage-live-${organisation.id}`),
      ),
    em
      .repo(Player)
      .count(
        { game: { organisation }, devBuild: true },
        getResultCacheOptions(`player-usage-dev-${organisation.id}`),
      ),
    em
      .repo(DeletedPlayer)
      .count(
        { game: { organisation }, createdAt: { $gte: monthStart, $lt: nextMonthStart } },
        getResultCacheOptions(`player-usage-deleted-${organisation.id}`),
      ),
  ])

  return { live, dev, deleted }
}
