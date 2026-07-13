import AdminAPIKey, { AdminAPIKeyScope } from '../../src/entities/admin-api-key.js'
import Game from '../../src/entities/game.js'
import User from '../../src/entities/user.js'
import { generateAdminAPIKey } from '../../src/routes/protected/admin-api-key/common.js'
import GameFactory from '../fixtures/GameFactory.js'
import UserFactory from '../fixtures/UserFactory.js'

export async function createAdminAPIKey(
  scopes: AdminAPIKeyScope[] = [],
  overrides?: { game: Game; user: User },
) {
  const user = overrides?.user ?? (await new UserFactory().one())
  const game = overrides?.game ?? (await new GameFactory(user.organisation).one())

  const { key, keyHash, keyEnding } = generateAdminAPIKey()
  const apiKey = new AdminAPIKey({ game, createdByUser: user, keyHash, keyEnding })
  apiKey.scopes = scopes

  await em.persist(apiKey).flush()

  return { apiKey, keyString: key }
}
