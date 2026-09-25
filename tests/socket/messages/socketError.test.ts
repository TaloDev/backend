import type SocketConnection from '../../../src/socket/socketConnection.js'
import SocketError, {
  SocketClientError,
  sendError,
  shouldReportToSentry,
} from '../../../src/socket/messages/socketError.js'

const listenerError = () =>
  new SocketError('LISTENER_ERROR', 'An error occurred while processing the message', 'boom')

describe('socketError', () => {
  describe('shouldReportToSentry', () => {
    it('should report unexpected listener errors', () => {
      expect(shouldReportToSentry(listenerError(), new Error('boom'))).toBe(true)
    })

    it('should not report expected client errors', () => {
      expect(
        shouldReportToSentry(listenerError(), new SocketClientError('Player not in channel')),
      ).toBe(false)
    })

    it('should not report errors that are not sentried at all', () => {
      expect(shouldReportToSentry(new SocketError('INVALID_SIGNATURE', 'Invalid signature'))).toBe(
        false,
      )
    })
  })

  it('should still send unexpected listener errors to the client', () => {
    const sendMessage = vi.fn()

    sendError({
      conn: { sendMessage } as unknown as SocketConnection,
      req: 'v1.channels.message',
      error: listenerError(),
      originalError: new Error('boom'),
    })

    expect(sendMessage).toHaveBeenCalledWith('v1.error', {
      req: 'v1.channels.message',
      message: 'An error occurred while processing the message',
      errorCode: 'LISTENER_ERROR',
      cause: 'boom',
    })
  })

  it('should still send expected client errors to the client', () => {
    const sendMessage = vi.fn()

    sendError({
      conn: { sendMessage } as unknown as SocketConnection,
      req: 'v1.channels.message',
      error: listenerError(),
      originalError: new SocketClientError('Player not in channel'),
    })

    expect(sendMessage).toHaveBeenCalledWith('v1.error', {
      req: 'v1.channels.message',
      message: 'An error occurred while processing the message',
      errorCode: 'LISTENER_ERROR',
      cause: 'boom',
    })
  })
})
