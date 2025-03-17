import { MikroORM } from '@mikro-orm/mysql'
import ormConfig from '../../config/mikro-orm.config'
import FailedJob from '../../entities/failed-job'
import * as Sentry from '@sentry/node'
import { Job } from 'bullmq'

async function handleJobFailure<T>(job: Job<T>, err: Error): Promise<void> {
  const orm = await MikroORM.init(ormConfig)
  const em = orm.em.fork()

  const failedJob = new FailedJob()
  failedJob.payload = job.data as unknown as (typeof failedJob.payload)
  failedJob.queue = job.queueName
  failedJob.reason = err.message
  /* v8 ignore next */
  failedJob.stack = err.stack ?? ''

  await em.persistAndFlush(failedJob)
  await orm.close()

  Sentry.setContext('queue', {
    'Name': job.queueName,
    'Failed Job ID': failedJob.id
  })
  Sentry.captureException(err)
}

export default handleJobFailure
