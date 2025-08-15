import DataExport, { DataExportStatus } from '../../../entities/data-export'
import { getMikroORM } from '../../../config/mikro-orm.config'

type UpdatedDataExportStatus = {
  id?: DataExportStatus
  failedAt?: Date
}

export async function updateDataExportStatus(dataExportId: number, newStatus: UpdatedDataExportStatus) {
  const orm = await getMikroORM()
  const em = orm.em.fork()

  const dataExport = await em.getRepository(DataExport).findOneOrFail(dataExportId)
  if (newStatus.id) {
    console.info(`Data export (${dataExportId}) - status updated from ${dataExport.status} to ${newStatus.id}`)
    dataExport.status = newStatus.id
  }
  if (newStatus.failedAt) {
    console.info(`Data export (${dataExportId}) - status updated from ${dataExport.status} to failed`)
    dataExport.failedAt = newStatus.failedAt
  }

  await em.flush()
}
