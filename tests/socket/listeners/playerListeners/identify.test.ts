import request from 'superwstest'
import Socket from '../../../../src/socket'
import { APIKeyScope } from '../../../../src/entities/api-key'
import createSocketIdentifyMessage from '../../../utils/requestAuthedSocket'
import PlayerAlias from '../../../../src/entities/player-alias'
import PlayerAliasFactory from '../../../fixtures/PlayerAliasFactory'
import PlayerAuthFactory from '../../../fixtures/PlayerAuthFactory'
import { EntityManager } from '@mikro-orm/mysql'

describe('Player listeners - identify', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should successfully identify a player', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson(identifyMessage)
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
        expect(actual.data.id).toBe(player.aliases[0].id)
      })
      .close()
  })

  it('should require the socket token to be valid', async () => {
    const [identifyMessage, token] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson({
        ...identifyMessage,
        data: {
          ...identifyMessage.data,
          socketToken: 'invalid'
        }
      })
      .expectJson({
        res: 'v1.error',
        data: {
          req: 'v1.players.identify',
          message: 'Invalid socket token',
          errorCode: 'INVALID_SOCKET_TOKEN'
        }
      })
      .close()
  })

  it('should require a valid session token to identify Talo aliases', async () => {
    const [identifyMessage, token, player] = await createSocketIdentifyMessage([APIKeyScope.READ_PLAYERS])
    const alias = await new PlayerAliasFactory(player).talo().one()
    const auth = await new PlayerAuthFactory().one()
    player.aliases.add(alias)
    player.auth = auth
    await (<EntityManager>global.em).persistAndFlush(player)

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .sendJson({
        req: 'v1.players.identify',
        data: {
          playerAliasId: alias.id,
          socketToken: identifyMessage.data.socketToken
        }
      })
      .expectJson((actual) => {
        expect(actual.res).toBe('v1.players.identify.success')
        expect(actual.data.id).toBe(player.aliases[0].id)
      })
      .close()
  })
})
