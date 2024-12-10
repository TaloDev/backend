import request from 'superwstest'
import Socket from '../../src/socket'
import createAPIKeyAndToken from '../utils/createAPIKeyAndToken'
import { isToday, subDays } from 'date-fns'
import { EntityManager } from '@mikro-orm/mysql'

describe('Socket server', () => {
  let socket: Socket

  beforeAll(() => {
    socket = new Socket(global.server, global.em)
  })

  afterAll(() => {
    socket.getServer().close()
  })

  it('should send a connected message when sending an auth header', async () => {
    const [apiKey, token] = await createAPIKeyAndToken([])
    apiKey.lastUsedAt = subDays(new Date(), 1)
    await (<EntityManager>global.em).flush()

    await request(global.server)
      .ws('/')
      .set('authorization', `Bearer ${token}`)
      .expectJson({
        res: 'v1.connected',
        data: {}
      })
      .close()

    await (<EntityManager>global.em).refresh(apiKey)
    expect(isToday(apiKey.lastUsedAt)).toBe(true)
  })

  it('should close connections without an auth header', async () => {
    await request(global.server)
      .ws('/')
      .expectClosed(3000)
  })
})
