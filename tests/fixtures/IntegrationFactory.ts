import { Factory } from 'hefty'
import Integration from '../../src/entities/integration'

export default class IntegrationFactory extends Factory<Integration> {
  constructor() {
    super(Integration)
  }
}
