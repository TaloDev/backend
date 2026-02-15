import { getMikroORM } from '../../config/mikro-orm.config'
import FailedJob from '../../entities/failed-job'
import * as Sentry from '@sentry/node'
import { Job } from 'bullmq'

async function handleJobFailure<T>(job: Job<T>, err: Error): Promise<void> {
  const orm = await getMikroORM()
  const em = orm.em.fork()

  const failedJob = new FailedJob()
  failedJob.payload = job.data as unknown as (typeof failedJob.payload)
  failedJob.queue = job.queueName
  failedJob.reason = err.message.substring(0, 255)
  /* v8 ignore next */
  failedJob.stack = err.stack ?? ''

  await em.persist(failedJob).flush()

  /* v8 ignore next 3 */
  if (process.env.NODE_ENV !== 'test') {
    console.error(`Job failed in ${failedJob.queue} queue: ${failedJob.reason}`)
  }

  Sentry.withScope((scope) => {
    scope.setContext('queue', {
      'Name': job.queueName,
      'Failed Job ID': failedJob.id
    })
    Sentry.captureException(err)
  })
}

export default handleJobFailure
