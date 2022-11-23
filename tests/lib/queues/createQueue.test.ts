import { EntityManager } from '@mikro-orm/core'
import { differenceInDays } from 'date-fns'
import Koa from 'koa'
import init from '../../../src'
import FailedJob from '../../../src/entities/failed-job'
import createQueue from '../../../src/lib/queues/createQueue'

describe('Create queue', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should put failed jobs in the database', async () => {
    const payload = { message: 'knock knock' }

    const processMock = jest.fn().mockImplementation(async () => {
      throw new Error('Something went wrong')
    })

    const queue = createQueue('test', processMock)
    await queue.add('test-job', payload)

    expect(processMock).toHaveBeenCalledTimes(1)

    const failedJobs = await (<EntityManager>app.context.em).getRepository(FailedJob).findAll()
    expect(failedJobs).toHaveLength(1)
    const failedJob = failedJobs[0]

    expect(failedJob.queue).toBe('test')
    expect(failedJob.payload).toStrictEqual(payload)
    expect(failedJob.reason).toBe('Something went wrong')
    expect(differenceInDays(new Date(failedJob.failedAt), Date.now())).toBeLessThan(1)
  })
})
