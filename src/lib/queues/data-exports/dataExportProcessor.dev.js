import { register } from 'tsx/esm/api'

register()

const { default: processor } = await import('./dataExportProcessor.ts')

export default processor
