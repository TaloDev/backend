import { Factory } from 'hefty'
import Game from '../../src/entities/game.js'
import casual from 'casual'
import Organisation from '../../src/entities/organisation.js'
import Prop from '../../src/entities/prop.js'
import GameSecret from '../../src/entities/game-secret.js'

export default class GameFactory extends Factory<Game> {
  private organisation: Organisation

  constructor(organisation: Organisation) {
    super(Game, 'base')
    this.register('base', this.base)

    this.organisation = organisation
  }

  protected base(): Partial<Game> {
    const availableProps = ['xpRate', 'maxLevel', 'halloweenEventNumber', 'christmasEventNumber', 'availableRooms', 'maxPlayersPerServer', 'structuresBuilt', 'maxCurrency']
    const propsCount = casual.integer(0, 3)
    const props: Prop[] = []

    for (let i = 0; i < propsCount; i++) {
      props.push({
        key: casual.random_element(availableProps),
        value: String(casual.integer(0, 99))
      })
    }

    return {
      name: casual.random_element(['Crawle', 'ISMAK', 'Sorce', 'The Trial', 'You Only Got One Shot', 'Vigilante 2084', 'Trigeon', 'Twodoors', 'Keyboard Twister', 'Spacewatch', 'I Wanna Be The Ghostbuster', 'In Air', 'Superstatic', 'Heart Heist', 'Entropy', 'Shattered', 'Boatyio', 'Scrunk', 'No-thing Island', 'Night Keeper', 'Curse of the Loop', 'Shook']),
      organisation: this.organisation,
      props,
      apiSecret: new GameSecret()
    }
  }
}
