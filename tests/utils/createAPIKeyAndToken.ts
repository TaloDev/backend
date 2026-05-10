import APIKey, { APIKeyScope } from '../../src/entities/api-key.js'
import { createToken } from '../../src/routes/protected/api-key/common.js'
import GameFactory from '../fixtures/GameFactory.js'
import UserFactory from '../fixtures/UserFactory.js'

export default async function createAPIKeyAndToken(
  scopes: APIKeyScope[],
): Promise<[APIKey, string]> {
  const user = await new UserFactory().one()

  const game = await new GameFactory(user.organisation).one()
  const apiKey = new APIKey(game, user)
  apiKey.scopes = scopes
  await em.persist(apiKey).flush()

  const token = await createToken(em, apiKey)
  return [apiKey, token]
}
