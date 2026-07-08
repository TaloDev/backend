import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../entities/organisation.js'
import { getPlayerUsageBreakdown } from './getPlayerUsageBreakdown.js'

export async function getBillablePlayerCount(em: EntityManager, organisation: Organisation) {
  const { live, dev, deleted } = await getPlayerUsageBreakdown(em, organisation)
  return live + dev + deleted
}
