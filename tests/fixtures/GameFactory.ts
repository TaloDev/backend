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
      name: casual.random_element(['Crawle', 'ISMAK', 'Sorce', 'The Trial', 'You Only Got One Shot', 'Vigilante 2084', 'Trigeon', 'Twodoors', 'Keyboard Twister', 'Spacewatch', 'I Wanna Be The Ghostbuster', 'In Air', 'Superstatic', 'Heart Heist', 'Entropy', 'Shattered', 'Boatyio', 'Scrunk', 'No-thing Island', 'Night Keeper', 'Curse of the Loop', 'Shook']),
      organisation: this.organisation
    }
  }
}
