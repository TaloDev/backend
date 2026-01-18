import createQueue from '../createQueue'
import { Job } from 'bullmq'
import path from 'path'
import fs from 'fs'
import { updateDataExportStatus } from './updateDataExportStatus'

export type DataExportJob = {
  dataExportId: number
  includeDevData: boolean
}

export function createDataExportQueue() {
  const filename = 'dataExportProcessor'
  const jsProcessorPath = path.join(__dirname, `${filename}.js`)
  const cjsProcessorPath = path.join(__dirname, `${filename}.cjs`)

  let processorPath: string
  /* v8 ignore start */
  if (fs.existsSync(jsProcessorPath)) {
    processorPath = jsProcessorPath
  } else if (fs.existsSync(cjsProcessorPath)) {
    // in development use a wrapper that loads the file via ts-node
    processorPath = cjsProcessorPath
  } else {
    throw new Error(`Data export processor file not found at either ${jsProcessorPath} or ${cjsProcessorPath}`)
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
