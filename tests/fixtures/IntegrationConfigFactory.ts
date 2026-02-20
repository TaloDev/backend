import { randBoolean, randNumber, randUuid } from '@ngneat/falso'
import { Factory } from 'hefty'
import { IntegrationConfig } from '../../src/entities/integration'

class IntegrationConfigProvider implements IntegrationConfig {
  apiKey!: string
  appId!: number
  syncLeaderboards!: boolean
  syncStats!: boolean
}

export default class IntegrationConfigFactory extends Factory<IntegrationConfigProvider> {
  constructor() {
    super(IntegrationConfigProvider)
  }

  protected override definition() {
    this.state(() => {
      return {
        apiKey: randUuid().replace(/-/g, ''),
        appId: randNumber({ min: 100000, max: 999999 }),
        syncLeaderboards: randBoolean(),
        syncStats: randBoolean(),
      }
    })
  }
}
