import { EntityManager } from '@mikro-orm/mysql'
import APIKey, { APIKeyScope } from '../../src/entities/api-key'
import { createToken } from '../../src/services/api-key.service'
import GameFactory from '../fixtures/GameFactory'
import UserFactory from '../fixtures/UserFactory'

export default async function createAPIKeyAndToken(scopes: APIKeyScope[]): Promise<[APIKey, string]> {
  const user = await new UserFactory().one()

  const game = await new GameFactory(user.organisation).one()
  const apiKey = new APIKey(game, user)
  apiKey.scopes = scopes
  await (<EntityManager>global.em).persistAndFlush(apiKey)

  const token = await createToken(<EntityManager>global.em, apiKey)
  return [apiKey, token]
}
