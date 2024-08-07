import { Factory } from 'hefty'
import casual from 'casual'
import GameSave from '../../src/entities/game-save'
import Player from '../../src/entities/player'
import randomDate from '../../src/lib/dates/randomDate'
import { sub } from 'date-fns'

export default class GameSaveFactory extends Factory<GameSave> {
  private availablePlayers: Player[]

  constructor(availablePlayers: Player[]) {
    super(GameSave)

    this.availablePlayers = availablePlayers
  }

  protected definition(): void {
    const objects = [...new Array(casual.integer(2, 5))].map(() => ({
      id: casual.uuid,
      name: casual.name,
      data: [
        {
          key: 'x',
          value: String(casual.double(-99, 99)),
          dataType: 'System.Single'
        },
        {
          key: 'y',
          value: String(casual.double(-99, 99)),
          dataType: 'System.Single'
        },
        {
          key: 'z',
          value: String(casual.double(-99, 99)),
          dataType: 'System.Single'
        }
      ]
    }))

    const player = casual.random_element(this.availablePlayers)

    this.state(() => ({
      name: `save-level${casual.integer(1, 20)}-${Date.now()}`,
      content: {
        objects
      },
      player,
      updatedAt: randomDate(sub(new Date(), { weeks: 2 }), new Date())
    }))
  }
}
