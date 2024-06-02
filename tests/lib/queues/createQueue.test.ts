import { EntityManager } from '@mikro-orm/mysql'
import { differenceInDays } from 'date-fns'
import FailedJob from '../../../src/entities/failed-job.js'
import createQueue from '../../../src/lib/queues/createQueue.js'

describe('Create queue', () => {
  it('should put failed jobs in the database', async () => {
    const payload = { message: 'knock knock' }

    const processMock = vi.fn().mockImplementation(async () => {
      throw new Error('Something went wrong')
    })

    const queue = createQueue('test', processMock)
    await queue.add('test-job', payload)

    expect(processMock).toHaveBeenCalledTimes(1)

    const failedJobs = await (<EntityManager>global.em).getRepository(FailedJob).findAll()
    expect(failedJobs).toHaveLength(1)
    const failedJob = failedJobs[0]

    expect(failedJob.queue).toBe('test')
    expect(failedJob.payload).toStrictEqual(payload)
    expect(failedJob.reason).toBe('Something went wrong')
    expect(differenceInDays(new Date(failedJob.failedAt), Date.now())).toBeLessThan(1)
  })
})
