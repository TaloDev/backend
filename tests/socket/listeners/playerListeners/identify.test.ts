import { APIKeyScope } from '../../../../src/entities/api-key'
import createSocketIdentifyMessage from '../../../utils/createSocketIdentifyMessage'
import createAPIKeyAndToken from '../../../utils/createAPIKeyAndToken'
import PlayerFactory from '../../../fixtures/PlayerFactory'
import { createSocketTicket } from '../../../../src/services/api/socket-ticket-api.service'
import createTestSocket from '../../../utils/createTestSocket'

describe('Player listeners - identify', () => {
  it('should successfully identify a player', async () => {
    const { identifyMessage, ticket, player } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson(identifyMessage)
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
        expect(actual.data.id).toBe(player.aliases[0].id)
      })
    })
  })

  it('should require the socket token to be valid', async () => {
    const { identifyMessage, ticket } = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson({
        ...identifyMessage,
        data: {
          ...identifyMessage.data,
          socketToken: 'invalid'
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.players.identify',
          message: 'Invalid socket token',
          errorCode: 'INVALID_SOCKET_TOKEN'
        }
      })
    })
  })

  it('should require a valid session token to identify Talo aliases', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persistAndFlush(player)

    const ticket = await createSocketTicket(redis, apiKey, false)
    const socketToken = await player.aliases[0].createSocketToken(redis)

    const sessionToken = await player.auth!.createSession(player.aliases[0])
    await em.flush()

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson({
        req: 'v1.players.identify',
        data: {
          playerAliasId: player.aliases[0].id,
          socketToken: socketToken,
          sessionToken: sessionToken
        }
      })
      await client.expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
        expect(actual.data.id).toBe(player.aliases[0].id)
      })
    })
  })

  it('should reject identify for Talo aliases without a valid session token', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persistAndFlush(player)

    const ticket = await createSocketTicket(redis, apiKey, false)
    const socketToken = await player.aliases[0].createSocketToken(redis)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson({
        req: 'v1.players.identify',
        data: {
          playerAliasId: player.aliases[0].id,
          socketToken: socketToken,
          sessionToken: 'blah'
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.players.identify',
          message: 'Invalid session token',
          errorCode: 'INVALID_SESSION_TOKEN'
        }
      })
    })
  })

  it('should reject identify for Talo aliases a missing session token', async () => {
    const [apiKey] = await createAPIKeyAndToken([APIKeyScope.READ_PLAYERS])
    const player = await new PlayerFactory([apiKey.game]).withTaloAlias().one()
    await em.persistAndFlush(player)

    const ticket = await createSocketTicket(redis, apiKey, false)
    const socketToken = await player.aliases[0].createSocketToken(redis)

    await createTestSocket(`/?ticket=${ticket}`, async (client) => {
      client.sendJson({
        req: 'v1.players.identify',
        data: {
          playerAliasId: player.aliases[0].id,
          socketToken: socketToken
        }
      })
      await client.expectJsonToStrictEqual({
        res: 'v1.error',
        data: {
          req: 'v1.players.identify',
          message: 'Invalid session token',
          errorCode: 'INVALID_SESSION_TOKEN'
        }
      })
    })
  })
})
