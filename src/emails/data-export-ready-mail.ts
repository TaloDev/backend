import Mail, { AttachmentData } from './mail'

export default class DataExportReady extends Mail {
  constructor(to: string, attachments: AttachmentData[], downloadUrl?: string) {
    super(
      to,
      'Your data export is ready',
      "We've finished processing your data export request and it is now available to download.",
    )

    this.title = 'Your data export is ready'
    this.why = 'You are receiving this email because you requested a data export'

    if (downloadUrl) {
      this.mainText = "We've generated your data export. This link will expire in 7 days."
      this.ctaLink = downloadUrl
      this.ctaText = 'Download export'
    } else {
      this.mainText = "We've attached it to this email for you."
      this.attachments = attachments
    }
  }
}
