import { EntityManager } from '@mikro-orm/mysql'
import Game from '../../entities/game.js'
import Integration from '../../entities/integration.js'
import { getResultCacheOptions } from '../perf/getResultCacheOptions.js'

export default async function triggerIntegrations(
  em: EntityManager,
  game: Game,
  callback: (integration: Integration) => void | Promise<void>,
) {
  const integrations = await em
    .repo(Integration)
    .find({ game }, getResultCacheOptions(`integrations-${game.id}`))

  await Promise.all(integrations.map(async (integration) => await callback(integration)))
}
