import { EntityManager } from '@mikro-orm/mysql'
import APIKey, { APIKeyScope } from '../../src/entities/api-key.js'
import { createToken } from '../../src/services/api-key.service.js'
import GameFactory from '../fixtures/GameFactory.js'
import UserFactory from '../fixtures/UserFactory.js'

export default async function createAPIKeyAndToken(scopes: APIKeyScope[]): Promise<[APIKey, string]> {
  const user = await new UserFactory().one()

  const game = await new GameFactory(user.organisation).one()
  const apiKey = new APIKey(game, user)
  apiKey.scopes = scopes
  await (<EntityManager>global.em).persistAndFlush(apiKey)

  const token = await createToken(<EntityManager>global.em, apiKey)
  return [apiKey, token]
}
