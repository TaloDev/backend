import createQueue from '../createQueue'
import { Job } from 'bullmq'
import path from 'path'
import type { DataExportJob } from './dataExportProcessor'
import { updateDataExportStatus } from './updateDataExportStatus'
import fs from 'fs'

export function createDataExportQueue() {
  const processorPath = path.join(__dirname, 'dataExportProcessor.ts')
  const exists = fs.existsSync(processorPath)

  /* v8 ignore start */
  if (!exists) {
    throw new Error(`Data export processor file not found at ${processorPath}`)
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
