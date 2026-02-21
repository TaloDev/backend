import { SandboxedJob } from 'bullmq'
import { rm } from 'fs/promises'
import { DataExportAvailableEntities, DataExportStatus } from '../../../../src/entities/data-export'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail'
import { DataExportJob } from '../../../../src/lib/queues/data-exports/createDataExportQueue'
import dataExportProcessor, {
  DataExporter,
} from '../../../../src/lib/queues/data-exports/dataExportProcessor'
import DataExportFactory from '../../../fixtures/DataExportFactory'
import GameActivityFactory from '../../../fixtures/GameActivityFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'

describe('Data export - processor', () => {
  afterEach(async () => {
    await rm('storage', { recursive: true, force: true })
  })

  it('should process a data export', async () => {
    vi.spyOn(sendEmail, 'default').mockResolvedValueOnce()

    const [organisation, game] = await createOrganisationAndGame()
    const [, user] = await createUserAndToken({}, organisation)

    const gameActivities = await new GameActivityFactory([game], [user]).many(10)

    const dataExport = await new DataExportFactory(game)
      .state(() => ({
        entities: [DataExportAvailableEntities.GAME_ACTIVITIES],
      }))
      .one()

    await em.persistAndFlush([...gameActivities, dataExport])

    const job = {
      data: {
        dataExportId: dataExport.id,
        includeDevData: true,
      },
    } as unknown as SandboxedJob<DataExportJob>
    await dataExportProcessor(job)

    const updatedDataExport = await em.refreshOrFail(dataExport)
    expect(updatedDataExport.status).toBe(DataExportStatus.SENT)
  })

  it('should handle errors', async () => {
    vi.spyOn(DataExporter.prototype, 'createZipStream').mockRejectedValueOnce(new Error('bad news'))

    const [, game] = await createOrganisationAndGame()

    const dataExport = await new DataExportFactory(game)
      .state(() => ({
        entities: [DataExportAvailableEntities.GAME_FEEDBACK],
      }))
      .one()

    await em.persist(dataExport).flush()

    const job = {
      data: {
        dataExportId: dataExport.id,
        includeDevData: true,
      },
    } as unknown as SandboxedJob<DataExportJob>

    await expect(dataExportProcessor(job)).rejects.toThrow('bad news')
  })
})
