import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Queue } from 'bullmq'
import DataExportReady from '../../../src/emails/data-export-ready-mail'
import queueEmail from '../../../src/lib/messaging/queueEmail'
import Mail, { EmailConfig } from '../../../src/emails/mail'
import createEmailQueue from '../../../src/lib/queues/createEmailQueue'
import * as checkRateLimitExceeded from '../../../src/lib/errors/checkRateLimitExceeded'

const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
const checkRateLimitExceededMock = vi.spyOn(checkRateLimitExceeded, 'default')

class TestMail extends Mail {
  constructor(to: string, subject: string, preheader: string) {
    super(to, subject, preheader)
  }
}

describe('Queue email', () => {
  let mockEmailQueue: Queue<EmailConfig>

  beforeEach(() => {
    vi.clearAllMocks()

    mockEmailQueue = createEmailQueue()
    vi.spyOn(mockEmailQueue, 'add')

    checkRateLimitExceededMock.mockClear()
    consoleWarnSpy.mockClear()
  })

  it('should rate limit the same email type/recipient after 3 attempts', async () => {
    const recipient = 'test@example.com'
    const mail1 = new DataExportReady(recipient, [])

    await queueEmail(mockEmailQueue, mail1)
    expect(mockEmailQueue.add).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).not.toHaveBeenCalled()

    await queueEmail(mockEmailQueue, mail1)
    expect(mockEmailQueue.add).toHaveBeenCalledTimes(2)
    expect(consoleWarnSpy).not.toHaveBeenCalled()

    await queueEmail(mockEmailQueue, mail1)
    expect(mockEmailQueue.add).toHaveBeenCalledTimes(3)
    expect(consoleWarnSpy).not.toHaveBeenCalled()

    await queueEmail(mockEmailQueue, mail1)
    expect(mockEmailQueue.add).toHaveBeenCalledTimes(3)
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(`Mail rate limit exceeded (to: ${recipient}, type: DataExportReady)`)
  })

  it('should not rate limit different email types or recipients', async () => {
    const mail1 = new TestMail('user1@example.com', 'Test', 'Testing')
    const mail2 = new TestMail('user2@example.com', 'Test', 'Testing')
    const mail3 = new DataExportReady('bob@example.com', [])

    await queueEmail(mockEmailQueue, mail1)
    await queueEmail(mockEmailQueue, mail2)
    await queueEmail(mockEmailQueue, mail3)

    expect(mockEmailQueue.add).toHaveBeenCalledTimes(3)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })
})
