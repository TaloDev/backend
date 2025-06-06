import emailTemplate from './email-template'
import * as Handlebars from 'handlebars'

export type MailData = {
  to: string
  from: {
    email: string
    name: string
  }
  subject: string
  html: string
  attachments?: AttachmentData[]
}

export type AttachmentData = {
  content: string
  filename: string
  type?: string
  disposition?: string
  content_id?: string
}

export default class Mail {
  template: string

  to: string
  attachments: AttachmentData[] = []

  subject: string
  preheader: string

  title!: string
  mainText!: string

  ctaLink!: string
  ctaText!: string

  footer: string
  footerText: string

  why: string

  constructor(to: string, subject: string, preheader: string) {
    this.template = emailTemplate

    this.to = to
    this.subject = subject
    this.preheader = preheader

    this.footer = 'Need help?'
    this.footerText = 'Our team and community can be found <a href="https://trytalo.com/discord" target="_blank" style="color: #ffffff;">on Discord</a>.'

    this.why = 'You are receiving this email because you have a Talo account'
  }

  getConfig(): MailData {
    const template = Handlebars.compile(this.template)
    const html = template({
      preheader: this.preheader,
      title: this.title,
      mainText: this.mainText,
      ctaLink: this.ctaLink,
      ctaText: this.ctaText,
      footer: this.footer,
      footerText: this.footerText,
      why: this.why
    })

    return {
      to: this.to,
      from: {
        email: process.env.FROM_EMAIL!,
        name: 'Talo Team'
      },
      subject: this.subject,
      html,
      attachments: this.attachments
    }
  }
}
