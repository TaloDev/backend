import fs from 'fs'
import fsp from 'fs/promises'
import { DataExportStatus } from '../../../../src/entities/data-export'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail'
import { DataExportMailer } from '../../../../src/lib/queues/data-exports/dataExportMailer'
import DataExportFactory from '../../../fixtures/DataExportFactory'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame'

describe('DataExportMailer', () => {
  beforeAll(() => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((path) => {
      if (path === '/fake/storage') return Buffer.from('blah')
      throw new Error(`Unexpected path: ${path}`)
    })
    vi.spyOn(fsp, 'unlink').mockResolvedValue()
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('should correctly update the data export status if sending the email succeeds', async () => {
    vi.spyOn(sendEmail, 'default').mockResolvedValueOnce()

    const [, game] = await createOrganisationAndGame()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush(dataExport)

    const mailer = new DataExportMailer()
    await mailer.send(dataExport, '/fake/storage', 'export.zip')

    const updatedExport = await em.refreshOrFail(dataExport)
    expect(updatedExport.status).toBe(DataExportStatus.SENT)
  })

  it('should correctly update the data export status if sending the email fails', async () => {
    vi.spyOn(sendEmail, 'default').mockRejectedValueOnce(new Error())

    const [, game] = await createOrganisationAndGame()
    const dataExport = await new DataExportFactory(game).one()
    await em.persistAndFlush(dataExport)

    const mailer = new DataExportMailer()
    await mailer.send(dataExport, '/fake/storage', 'export.zip')

    const updatedExport = await em.refreshOrFail(dataExport)
    expect(updatedExport.failedAt).toBeTruthy()
  })
})
