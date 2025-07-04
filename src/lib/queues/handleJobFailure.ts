import { MikroORM } from '@mikro-orm/mysql'
import ormConfig from '../../config/mikro-orm.config'
import FailedJob from '../../entities/failed-job'
import { captureException, setContext } from '@sentry/node'
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

  /* v8 ignore next 3 */
  if (process.env.NODE_ENV !== 'test') {
    console.error(`Job failed in ${failedJob.queue} queue: ${failedJob.reason}`)
  }

  setContext('queue', {
    'Name': job.queueName,
    'Failed Job ID': failedJob.id
  })
  captureException(err)
}

export default handleJobFailure
