import { MikroORM } from '@mikro-orm/core'
import Queue from 'bee-queue'
import ormConfig from '../../config/mikro-orm.config'
import FailedJob from '../../entities/failed-job'

const handleJobFailure = async (job: Queue.Job<any>, err: Error): Promise<void> => {
  const orm = await MikroORM.init(ormConfig)

  const failedJob = new FailedJob()
  failedJob.payload = job.data
  failedJob.queue = job.queue.name
  failedJob.reason = err.message

  console.log(err.message)

  await orm.em.getRepository(FailedJob).persistAndFlush(failedJob)
  await orm.close()
}

export default handleJobFailure
