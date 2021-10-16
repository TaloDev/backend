import { MikroORM } from '@mikro-orm/core'
import Queue from 'bee-queue'
import ormConfig from '../../config/mikro-orm.config'
import FailedJob from '../../entities/failed-job'
import * as Sentry from '@sentry/node'

const handleJobFailure = async (job: Queue.Job<any>, err: Error): Promise<void> => {
  const orm = await MikroORM.init(ormConfig)

  const failedJob = new FailedJob()
  failedJob.payload = job.data
  failedJob.queue = job.queue.name
  failedJob.reason = err.message

  await orm.em.getRepository(FailedJob).persistAndFlush(failedJob)
  await orm.close()

  Sentry.setContext('queue', {
    'Name': job.queue.name,
    'Failed Job ID': failedJob.id
  })
  Sentry.captureException(err)
}

export default handleJobFailure
