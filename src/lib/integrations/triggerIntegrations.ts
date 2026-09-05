import { EntityManager } from '@mikro-orm/mysql'
import { captureException } from '@sentry/node'
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
    .find({ game }, getResultCacheOptions(Integration.getCacheKeyForGame(game)))

  // one failing integration must not block the others
  for (const integration of integrations) {
    try {
      await callback(integration)
    } catch (err) {
      captureException(err)
    }
  }
}
