import SendGrid from '@sendgrid/mail'

interface TemplateData {
  [key: string]: any
}

export default async (to: string, templateId: string, dynamicTemplateData: TemplateData): Promise<void> => {
  try {
    await SendGrid.send({
      to,
      from: 'hello@trytalo.com',
      templateId,
      dynamicTemplateData
    })
  } catch (err) {
    console.log(err)
    throw err
  }
}
