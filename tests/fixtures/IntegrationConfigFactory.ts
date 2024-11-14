import { Factory } from 'hefty'
import { IntegrationConfig } from '../../src/entities/integration'
import { randBoolean, randNumber, randUuid } from '@ngneat/falso'

class IntegrationConfigProvider implements IntegrationConfig {
  apiKey: string
  appId: number
  syncLeaderboards: boolean
  syncStats: boolean
}

export default class IntegrationConfigFactory extends Factory<IntegrationConfigProvider> {
  constructor() {
    super(IntegrationConfigProvider)
  }

  protected definition(): void {
    this.state(() => {
      return {
        apiKey: randUuid().replace(/-/g, ''),
        appId: randNumber({ min: 100000, max: 999999 }),
        syncLeaderboards: randBoolean(),
        syncStats: randBoolean()
      }
    })
  }
}
