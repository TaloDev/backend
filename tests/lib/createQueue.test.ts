import { EntityManager } from '@mikro-orm/core'
import { differenceInMinutes } from 'date-fns'
import Koa from 'koa'
import init from '../../src'
import FailedJob from '../../src/entities/failed-job'
import createQueue from '../../src/lib/queues/createQueue'
import waitForExpect from 'wait-for-expect'

describe('Create queue', () => {
  let app: Koa

  beforeAll(async () => {
    app = await init()
  })

  afterAll(async () => {
    await (<EntityManager>app.context.em).getConnection().close()
  })

  it('should put failed jobs in the database', async () => {
    const queue = createQueue('test')
    const payload = { message: 'knock knock' }

    const processMock = jest.fn().mockImplementation(async () => Promise.reject(new Error('Something went wrong')))

    queue.process(processMock)
    await queue.createJob(payload).save()

    expect(processMock).toHaveBeenCalledTimes(1)

    let failedJob: FailedJob

    await waitForExpect(async () => {
      const failedJobs = await (<EntityManager>app.context.em).getRepository(FailedJob).findAll()
      expect(failedJobs).toHaveLength(1)
      failedJob = failedJobs[0]
    })

    expect(failedJob.queue).toBe('test')
    expect(failedJob.payload).toStrictEqual(payload)
    expect(failedJob.reason).toBe('Something went wrong')
    expect(differenceInMinutes(new Date(failedJob.failedAt), Date.now())).toBeLessThan(2)
  })  
})
