import { rm } from 'fs/promises'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'
import createUserAndToken from '../../../utils/createUserAndToken'
import GameActivityFactory from '../../../fixtures/GameActivityFactory'
import DataExportFactory from '../../../fixtures/DataExportFactory'
import { DataExportAvailableEntities, DataExportStatus } from '../../../../src/entities/data-export'
import { SandboxedJob } from 'bullmq'
import dataExportProcessor, { DataExportJob } from '../../../../src/lib/queues/data-exports/dataExportProcessor'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail'

describe('Data export service - processor', () => {
  afterEach(async () => {
    await rm('storage', { recursive: true, force: true })
  })

  it('should process a data export', async () => {
    vi.spyOn(sendEmail, 'default').mockResolvedValueOnce()

    const [organisation, game] = await createOrganisationAndGame()
    const [, user] = await createUserAndToken({}, organisation)

    const gameActivities = await new GameActivityFactory([game], [user]).many(10)

    const dataExport = await new DataExportFactory(game).state(() => ({
      entities: [DataExportAvailableEntities.GAME_ACTIVITIES]
    })).one()

    await em.persistAndFlush([...gameActivities, dataExport])

    const job = {
      data: {
        dataExportId: dataExport.id,
        includeDevData: true
      }
    } as unknown as SandboxedJob<DataExportJob>
    await dataExportProcessor(job)

    const updatedDataExport = await em.refreshOrFail(dataExport)
    expect(updatedDataExport.status).toBe(DataExportStatus.SENT)
  })
})
