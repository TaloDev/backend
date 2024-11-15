import { Factory } from 'hefty'
import Game from '../../src/entities/game'
import Organisation from '../../src/entities/organisation'
import Prop from '../../src/entities/prop'
import GameSecret from '../../src/entities/game-secret'
import { rand, randNumber } from '@ngneat/falso'

export default class GameFactory extends Factory<Game> {
  private organisation: Organisation

  constructor(organisation: Organisation) {
    super(Game)

    this.organisation = organisation
  }

  protected definition(): void {
    const availableProps = ['xpRate', 'maxLevel', 'halloweenEventNumber', 'christmasEventNumber', 'availableRooms', 'maxPlayersPerServer', 'structuresBuilt', 'maxCurrency']

    this.state(() => {
      const propsCount = randNumber({ max: 3 })
      const props: Prop[] = []

      for (let i = 0; i < propsCount; i++) {
        props.push({
          key: rand(availableProps),
          value: String(randNumber({ max: 99 }))
        })
      }

      return {
        name: rand(['Crawle', 'ISMAK', 'Sorce', 'The Trial', 'You Only Got One Shot', 'Vigilante 2084', 'Trigeon', 'Twodoors', 'Keyboard Twister', 'Spacewatch', 'I Wanna Be The Ghostbuster', 'In Air', 'Superstatic', 'Heart Heist', 'Entropy', 'Shattered', 'Boatyio', 'Scrunk', 'No-thing Island', 'Night Keeper', 'Curse of the Loop', 'Shook']),
        organisation: this.organisation,
        props,
        apiSecret: new GameSecret()
      }
    })
  }
}
