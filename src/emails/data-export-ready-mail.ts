import Mail, { AttachmentData } from './mail.js'

export default class DataExportReady extends Mail {
  constructor(to: string, attachments: AttachmentData[]) {
    super(to, 'Your data export is ready', 'We\'ve finished processing your data export request and it is now available to download.')

    this.title = 'Your data export is ready'
    this.mainText = 'We\'ve attached it to this email for you.'

    this.why = 'You are receiving this email because you requested a data export'

    this.attachments = attachments
  }
}
