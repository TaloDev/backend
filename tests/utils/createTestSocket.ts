
import { createServer } from 'http'
import Socket from '../../src/socket'
import { randNumber } from '@ngneat/falso'
import { WebSocket } from 'ws'
import { IdentifyMessage } from './createSocketIdentifyMessage'

class TestClient extends WebSocket {
  private messages: string[] = []
  private closed = false
  private closeCode?: number
  private closeReason?: string

  constructor(url: string) {
    super(url)
    this.on('message', (message) => {
      this.messages.push(message.toString())
    })
    this.on('close', (code, reason) => {
      this.closed = true
      this.closeCode = code
      this.closeReason = reason.toString()
    })
  }

  async identify(message: IdentifyMessage) {
    this.sendJson(message)

    await this.expectJson((json) => {
      expect(json.res).toBe('v1.players.identify.success')
      expect(json.data.id).toBe(message.data.playerAliasId)
    })
  }

  expectReady() {
    return this.expectJsonToStrictEqual({
      res: 'v1.connected',
      data: {}
    })
  }

  expectClosed(code?: number, reason?: string) {
    return vi.waitUntil(() => {
      return this.closed &&
        (code !== undefined ? this.closeCode === code : true) &&
        (reason !== undefined ? this.closeReason === reason : true)
    })
  }

  sendJson<T extends object>(json: T) {
    this.messages = []
    this.send(JSON.stringify(json))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async expectJson(cb: (json: any) => void) {
    try {
      await vi.waitUntil(async () => {
        for (const message of this.messages.reverse()) {
          try {
            cb(JSON.parse(message))
            return true
          } catch {
            continue
          }
        }
        return false
      })
    } catch (err) {
      throw new Error('Message not found')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async dontExpectJson(cb: (json: any) => void) {
    try {
      await this.expectJson(cb)
      throw new Error('Unexpected message found')
    } catch (err) {
      if (err instanceof Error && err.message === 'Message not found') {
        return
      }
      throw err
    }
  }

  async expectJsonToStrictEqual(json: object) {
    try {
      await this.expectJson((actual) => {
        expect(actual).toStrictEqual(json)
      })
    } catch (err) {
      throw new Error(`Message not found: ${JSON.stringify(json)}`)
    }
  }
}

type TestSocketOptions = {
  waitForReady?: boolean
}

function getRandPort() {
  return randNumber({ min: 1024, max: 65535 })
}

export default async function createTestSocket(
  url: string,
  cb: (client: TestClient, wss: Socket) => Promise<void>,
  opts: TestSocketOptions = {
    waitForReady: true
  }
) {
  const server = createServer()
  let port = getRandPort()
  let bound = false

  while (!bound) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, () => {
          server.removeAllListeners('error')
          bound = true
          resolve()
        })
      })
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'EADDRINUSE') {
        port = getRandPort()
        continue
      }
      throw err
    }
  }

  const wss = new Socket(server, global.em)
  global.ctx.wss = wss

  const client = new TestClient(`ws://localhost:${port}${url}`)
  if (opts.waitForReady) {
    await client.expectReady()
  }
  await cb(client, wss)
  client.close()
  await vi.waitUntil(() => wss.findConnections(() => true).length === 0)

  await new Promise<void>((resolve) => server.close(() => resolve()))
}
