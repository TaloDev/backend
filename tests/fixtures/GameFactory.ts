import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import casual from 'casual'
import Organisation from '../../src/entities/organisation'

export default class GameFactory extends Factory<Game> {
  private organisation: Organisation

  constructor(organisation: Organisation) {
    super(Game, 'base')
    this.register('base', this.base)

    this.organisation = organisation
  }

  protected base(): Partial<Game> {
    return {
      name: casual.title,
      organisation: this.organisation
    }
  }
}
