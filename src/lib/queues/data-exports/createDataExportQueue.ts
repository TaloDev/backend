import createQueue from '../createQueue'
import { Job } from 'bullmq'
import path from 'path'
import { DataExportJob } from './dataExportProcessor'
import fs from 'fs'
import { updateDataExportStatus } from './updateDataExportStatus'

export function createDataExportQueue() {
  const processorBasePath = path.join('lib', 'queues', 'data-exports', 'dataExportProcessor')
  const jsProcessorPath = path.join(process.cwd(), `${processorBasePath}.js`)
  const tsProcessorPath = path.join(process.cwd(), 'src', `${processorBasePath}.ts`)

  let processorPath: string

  /* v8 ignore start */
  if (fs.existsSync(jsProcessorPath)) {
    processorPath = jsProcessorPath
  } else if (fs.existsSync(tsProcessorPath)) {
    processorPath = tsProcessorPath
  } else {
    throw new Error(`Data export processor file not found at either ${jsProcessorPath} or ${tsProcessorPath}`)
  }
  /* v8 ignore stop */

  return createQueue<DataExportJob>(
    'data-export',
    processorPath,
    {
      failed: async (job: Job<DataExportJob>) => {
        await updateDataExportStatus(job.data.dataExportId, { failedAt: new Date() })
      }
    }
  )
}
