import { MikroORM } from '@mikro-orm/mysql'
import ormConfig from '../../../config/mikro-orm.config'
import DataExport, { DataExportStatus } from '../../../entities/data-export'

type UpdatedDataExportStatus = {
  id?: DataExportStatus
  failedAt?: Date
}

export async function updateDataExportStatus(dataExportId: number, newStatus: UpdatedDataExportStatus) {
  const orm = await MikroORM.init(ormConfig)
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
  await orm.close()
}
