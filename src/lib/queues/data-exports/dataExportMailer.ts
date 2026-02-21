import { Job, Queue } from 'bullmq'
import fs from 'fs'
import fsp from 'fs/promises'
import assert from 'node:assert'
import DataExportReady from '../../../emails/data-export-ready-mail'
import { EmailConfig } from '../../../emails/mail'
import DataExport, { DataExportStatus } from '../../../entities/data-export'
import queueEmail from '../../messaging/queueEmail'
import { createEmailQueue } from '../createEmailQueue'
import { updateDataExportStatus } from './updateDataExportStatus'

export class DataExportMailer {
  private emailQueue: Queue<EmailConfig>

  constructor() {
    this.emailQueue = createEmailQueue(
      {
        completed: async (job: Job<EmailConfig>) => {
          const id = this.getDataExportIdFromJob(job)
          console.timeEnd(`Data export (${id}) - end to end`)
          await updateDataExportStatus(id, { id: DataExportStatus.SENT })
        },
        failed: async (job: Job<EmailConfig>) => {
          await updateDataExportStatus(this.getDataExportIdFromJob(job), { failedAt: new Date() })
        },
      },
      'data-export',
    )
  }

  getDataExportIdFromJob(job: Job<EmailConfig>) {
    const dataExportId = job.data.metadata?.dataExportId
    assert(dataExportId)
    return dataExportId as number
  }

  async send(dataExport: DataExport, filepath: string, filename: string) {
    await queueEmail(
      this.emailQueue,
      new DataExportReady(dataExport.createdByUser.email, [
        {
          content: fs.readFileSync(filepath).toString('base64'),
          filename,
          type: 'application/zip',
          disposition: 'attachment',
        },
      ]),
      { dataExportId: dataExport.id },
    )

    await fsp.unlink(filepath)
  }
}
