import { Factory } from 'hefty'
import Integration from '../../src/entities/integration.js'

export default class IntegrationFactory extends Factory<Integration> {
  constructor() {
    super(Integration)
  }
}
