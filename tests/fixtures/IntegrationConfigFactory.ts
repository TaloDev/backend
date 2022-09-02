import { Factory } from 'hefty'
import casual from 'casual'
import { IntegrationConfig } from '../../src/entities/integration'

class IntegrationConfigProvider implements IntegrationConfig {
  apiKey: string
  appId: number
  syncLeaderboards: boolean
  syncStats: boolean
}

export default class IntegrationConfigFactory extends Factory<IntegrationConfigProvider> {
  constructor() {
    super(IntegrationConfigProvider, 'base')

    this.register('base', this.base)
  }

  protected base(): Partial<IntegrationConfigProvider> {
    return {
      apiKey: casual.uuid.replace(/-/g, ''),
      appId: casual.integer(100000, 999999),
      syncLeaderboards: casual.boolean,
      syncStats: casual.boolean
    }
  }
}
