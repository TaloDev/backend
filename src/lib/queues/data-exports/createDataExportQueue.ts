import { Job } from 'bullmq'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import createQueue from '../createQueue.js'
import { updateDataExportStatus } from './updateDataExportStatus.js'

const dir = path.dirname(fileURLToPath(import.meta.url))

export type DataExportJob = {
  dataExportId: number
  includeDevData: boolean
}

export function createDataExportQueue() {
  const filename = 'dataExportProcessor'
  const jsProcessorPath = path.join(dir, `${filename}.js`)
  const devProcessorPath = path.join(dir, `${filename}.dev.js`)

  let processorPath: string
  /* v8 ignore start -- @preserve */
  if (fs.existsSync(jsProcessorPath)) {
    processorPath = jsProcessorPath
  } else if (fs.existsSync(devProcessorPath)) {
    // in development use a wrapper that registers tsx/esm to load the typescript file
    processorPath = devProcessorPath
  } else {
    throw new Error(
      `Data export processor file not found at either ${jsProcessorPath} or ${devProcessorPath}`,
    )
  }
  /* v8 ignore stop -- @preserve */

  return createQueue<DataExportJob>('data-export', processorPath, {
    events: {
      failed: async (job: Job<DataExportJob>) => {
        await updateDataExportStatus(job.data.dataExportId, { failedAt: new Date() })
      },
    },
    workerOptions: { lockDuration: 600_000 }, // 10 minutes
  })
}
