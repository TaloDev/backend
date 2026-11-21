import { differenceInDays } from 'date-fns'
import FailedJob from '../../../src/entities/failed-job.js'
import createQueue, {
  defaultRemoveOnComplete,
  defaultRemoveOnFail,
} from '../../../src/lib/queues/createQueue.js'

describe('Create queue', () => {
  beforeAll(async () => {
    await em.repo(FailedJob).nativeDelete({})
  })

  it('should put failed jobs in the database', async () => {
    const payload = { message: 'knock knock' }

    const processMock = vi.fn().mockImplementation(async () => {
      throw new Error('Something went wrong')
    })

    const queue = createQueue('test', processMock)
    await queue.add('test-job', payload)

    expect(processMock).toHaveBeenCalledTimes(1)

    const failedJobs = await em.repo(FailedJob).findAll()
    expect(failedJobs).toHaveLength(1)
    const failedJob = failedJobs[0]

    expect(failedJob.queue).toBe('test')
    expect(failedJob.payload).toStrictEqual(payload)
    expect(failedJob.reason).toBe('Something went wrong')
    expect(differenceInDays(new Date(failedJob.failedAt), Date.now())).toBeLessThan(1)
  })

  it('should bound completed and failed job retention by default', () => {
    const queue = createQueue('test-retention', async () => {})
    // @ts-expect-error workers only exist on the mocked queue
    const worker = queue.workers[0]

    expect(worker.opts.removeOnComplete).toStrictEqual(defaultRemoveOnComplete)
    expect(worker.opts.removeOnFail).toStrictEqual(defaultRemoveOnFail)
  })

  it('should allow job retention to be overridden', () => {
    const queue = createQueue('test-retention-override', async () => {}, {
      workerOptions: { removeOnComplete: { count: 0 }, removeOnFail: { count: 10 } },
    })
    // @ts-expect-error workers only exist on the mocked queue
    const worker = queue.workers[0]

    expect(worker.opts.removeOnComplete).toStrictEqual({ count: 0 })
    expect(worker.opts.removeOnFail).toStrictEqual({ count: 10 })
  })
})
