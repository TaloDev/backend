import request from 'supertest'
import { EntityManager } from '@mikro-orm/mysql'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createTestSocket from '../../../utils/createTestSocket'

describe('Player presence API service - put', () => {
  it('should update presence if the scope is valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    const res = await request(global.app)
      .put('/v1/players/presence')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .send({ online: true, customStatus: 'Playing game' })
      .expect(200)

    expect(res.body.presence.online).toBe(true)
    expect(res.body.presence.customStatus).toBe('Playing game')
  })

  it('should not update presence if the scope is not valid', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])

    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .put('/v1/players/presence')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .send({ online: true })
      .expect(403)
  })

  it('should not update presence with an invalid alias', async () => {
    const [, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const res = await request(global.app)
      .put('/v1/players/presence')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', '32144')
      .send({ online: true })
      .expect(404)

    expect(res.body).toStrictEqual({
      message: 'Player not found'
    })
  })

  it('should notify other players when presence is updated', async () => {
    const { identifyMessage, ticket, player, token } = await createSocketIdentifyMessage([
      APIKeyScope.READ_PLAYERS,
      APIKeyScope.WRITE_PLAYERS
    ])

    await (<EntityManager>global.em).persistAndFlush(player)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      await client.identify(identifyMessage)
      await request(global.app)
        .put('/v1/players/presence')
        .auth(token, { type: 'bearer' })
        .set('x-talo-alias', String(player.aliases[0].id))
        .send({ online: true, customStatus: 'Testing' })
        .expect(200)

      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.presence.updated')
        expect(actual.data.presence.online).toBe(true)
        expect(actual.data.presence.customStatus).toBe('Testing')
        expect(actual.data.presence.playerAlias.id).toBe(player.aliases[0].id)
        expect(actual.data.meta.onlineChanged).toBe(false) // already online after identifying
        expect(actual.data.meta.customStatusChanged).toBe(true)
      })
    })
  })

  it('should only update specified fields', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([APIKeyScope.WRITE_PLAYERS])

    const player = await new PlayerFactory([apiKey.game]).one()
    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.app)
      .put('/v1/players/presence')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .send({ online: true, customStatus: 'Initial status' })
      .expect(200)

    const res = await request(global.app)
      .put('/v1/players/presence')
      .auth(token, { type: 'bearer' })
      .set('x-talo-alias', String(player.aliases[0].id))
      .send({ customStatus: 'Updated status' })
      .expect(200)

    expect(res.body.presence.online).toBe(true)
    expect(res.body.presence.customStatus).toBe('Updated status')
  })
})
