import { EntityManager } from '@mikro-orm/mysql'
import request from 'supertest'
import { UserType } from '../../../src/entities/user'
import APIKey from '../../../src/entities/api-key'
import UserFactory from '../../fixtures/UserFactory'
import GameActivity, { GameActivityType } from '../../../src/entities/game-activity'
import userPermissionProvider from '../../utils/userPermissionProvider'
import createUserAndToken from '../../utils/createUserAndToken'
import createOrganisationAndGame from '../../utils/createOrganisationAndGame'
import { createSocketTicket } from '../../../src/services/api/socket-ticket-api.service'
import redisConfig from '../../../src/config/redis.config'
import { Redis } from 'ioredis'
import createTestSocket from '../../utils/createTestSocket'

describe('API key service - delete', () => {
  it.each(userPermissionProvider([
    UserType.ADMIN
  ], 204))('should return a %i for a %s user', async (statusCode, _, type) => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type, emailConfirmed: true }, organisation)

    const key = new APIKey(game, user)
    await (<EntityManager>global.em).persistAndFlush(key)

    const res = await request(global.app)
      .delete(`/games/${game.id}/api-keys/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(statusCode)

    await (<EntityManager>global.em).refresh(key)

    const activity = await (<EntityManager>global.em).getRepository(GameActivity).findOne({
      type: GameActivityType.API_KEY_REVOKED,
      game,
      extra: {
        keyId: key.id
      }
    })

    if (statusCode === 204) {
      expect(key.revokedAt).toBeTruthy()
      expect(activity).not.toBeNull()
    } else {
      expect(res.body).toStrictEqual({ message: 'You do not have permissions to revoke API keys' })

      expect(key.revokedAt).toBeNull()
      expect(activity).toBeNull()
    }
  })

  it('should not delete an api key that doesn\'t exist', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const res = await request(global.app)
      .delete(`/games/${game.id}/api-keys/99`)
      .auth(token, { type: 'bearer' })
      .expect(404)

    expect(res.body).toStrictEqual({ message: 'API key not found' })
  })

  it('should not delete an api key for a game the user has no access to', async () => {
    const [otherOrg, otherGame] = await createOrganisationAndGame()
    const [token] = await createUserAndToken({ type: UserType.ADMIN })

    const user = await new UserFactory().state(() => ({ organisation: otherOrg })).one()
    const key = new APIKey(otherGame, user)
    await (<EntityManager>global.em).persistAndFlush(key)

    const res = await request(global.app)
      .delete(`/games/${otherGame.id}/api-keys/${key.id}`)
      .auth(token, { type: 'bearer' })
      .expect(403)

    expect(res.body).toStrictEqual({ message: 'You need to confirm your email address to revoke API keys' })
  })

  it('should disconnect socket connections for the api key', async () => {
    const [organisation, game] = await createOrganisationAndGame()
    const [token, user] = await createUserAndToken({ type: UserType.ADMIN, emailConfirmed: true }, organisation)

    const key = new APIKey(game, user)
    await (<EntityManager>global.em).persistAndFlush(key)

    const redis = new Redis(redisConfig)
    const ticket = await createSocketTicket(redis, key, false)
    await redis.quit()

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.expectReady()

      await request(global.app)
        .delete(`/games/${game.id}/api-keys/${key.id}`)
        .auth(token, { type: 'bearer' })
        .expect(204)

      await client.expectClosed(3000)
    })
  })
})
