import fs from 'fs'
import fsp from 'fs/promises'
import { DataExportStatus } from '../../../../src/entities/data-export.js'
import * as sendEmail from '../../../../src/lib/messaging/sendEmail.js'
import { DataExportMailer } from '../../../../src/lib/queues/data-exports/dataExportMailer.js'
import * as s3Client from '../../../../src/lib/storage/s3Client.js'
import DataExportFactory from '../../../fixtures/DataExportFactory.js'
import createOrganisationAndGame from '../../../utils/createOrganisationAndGame.js'

const originalReadFileSync = fs.readFileSync

describe('DataExportMailer', () => {
  beforeAll(() => {
    vi.spyOn(fs, 'readFileSync').mockImplementation((path, options) => {
      if (path === '/fake/storage') {
        return Buffer.from('blah')
      }
      return originalReadFileSync(path, options)
    })
    vi.spyOn(fsp, 'unlink').mockResolvedValue()
    vi.spyOn(s3Client, 'isS3Configured').mockReturnValue(false)
  })

  afterAll(() => {
    vi.restoreAllMocks()
  })

  it('should correctly update the data export status if sending the email succeeds', async () => {
    vi.spyOn(sendEmail, 'default').mockResolvedValueOnce()

    const [, game] = await createOrganisationAndGame()
    const dataExport = await new DataExportFactory(game).one()
    await em.persist(dataExport).flush()

    const mailer = new DataExportMailer()
    await mailer.send(dataExport, '/fake/storage', 'export.zip')

    const updatedExport = await em.refreshOrFail(dataExport)
    expect(updatedExport.status).toBe(DataExportStatus.SENT)
  })

  it('should correctly update the data export status if sending the email fails', async () => {
    vi.spyOn(sendEmail, 'default').mockRejectedValueOnce(new Error())

    const [, game] = await createOrganisationAndGame()
    const dataExport = await new DataExportFactory(game).one()
    await em.persist(dataExport).flush()

    const mailer = new DataExportMailer()
    await mailer.send(dataExport, '/fake/storage', 'export.zip')

    const updatedExport = await em.refreshOrFail(dataExport)
    expect(updatedExport.failedAt).toBeTruthy()
  })

  describe('when S3 is configured', () => {
    beforeEach(() => {
      vi.spyOn(s3Client, 'isS3Configured').mockReturnValue(true)
      vi.spyOn(s3Client, 'uploadToS3').mockResolvedValue('https://s3.example.com/presigned-url')
      vi.spyOn(sendEmail, 'default').mockResolvedValue()
      vi.mocked(fs.readFileSync).mockClear()
    })

    it('should upload to S3 and send an email with a download link instead of an attachment', async () => {
      const [, game] = await createOrganisationAndGame()
      const dataExport = await new DataExportFactory(game).one()
      await em.persist(dataExport).flush()

      const mailer = new DataExportMailer()
      await mailer.send(dataExport, '/fake/storage', 'export.zip')

      expect(s3Client.uploadToS3).toHaveBeenCalledWith({
        filepath: '/fake/storage',
        key: `data-exports/game-id=${game.id}/export.zip`,
      })
      expect(fsp.unlink).toHaveBeenCalledWith('/fake/storage')
      expect(fs.readFileSync).not.toHaveBeenCalled()

      expect(sendEmail.default).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: [],
          templateData: expect.objectContaining({
            ctaLink: 'https://s3.example.com/presigned-url',
            ctaText: 'Download export',
          }),
        }),
      )
    })

    it('should correctly update the data export status after uploading', async () => {
      const [, game] = await createOrganisationAndGame()
      const dataExport = await new DataExportFactory(game).one()
      await em.persist(dataExport).flush()

      const mailer = new DataExportMailer()
      await mailer.send(dataExport, '/fake/storage', 'export.zip')

      const updatedExport = await em.refreshOrFail(dataExport)
      expect(updatedExport.status).toBe(DataExportStatus.SENT)
    })
  })
})
