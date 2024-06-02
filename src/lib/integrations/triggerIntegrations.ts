import { EntityManager } from '@mikro-orm/mysql'
import Game from '../../entities/game.js'
import Integration from '../../entities/integration.js'

export default async function triggerIntegrations(em: EntityManager, game: Game, callback: (integration: Integration) => void) {
  const integrations = await em.getRepository(Integration).find({ game })
  await Promise.all(integrations.map((integration) => callback(integration)))
}
