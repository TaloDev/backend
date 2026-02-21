import { rand, randFloat, randNumber, randText, randUuid } from '@ngneat/falso'
import { sub } from 'date-fns'
import { Factory } from 'hefty'
import GameSave from '../../src/entities/game-save'
import Player from '../../src/entities/player'
import randomDate from '../../src/lib/dates/randomDate'

export default class GameSaveFactory extends Factory<GameSave> {
  private availablePlayers: Player[]

  constructor(availablePlayers: Player[]) {
    super(GameSave)

    this.availablePlayers = availablePlayers
  }

  protected override definition() {
    const objects = Array.from({ length: randNumber({ min: 2, max: 5 }) }).map(() => ({
      id: randUuid(),
      name: randText(),
      data: [
        {
          key: 'x',
          value: String(randFloat({ min: -99, max: 99 })),
          dataType: 'System.Single',
        },
        {
          key: 'y',
          value: String(randFloat({ min: -99, max: 99 })),
          dataType: 'System.Single',
        },
        {
          key: 'z',
          value: String(randFloat({ min: -99, max: 99 })),
          dataType: 'System.Single',
        },
      ],
    }))

    const player = rand(this.availablePlayers)

    this.state(() => ({
      name: `save-level${randNumber({ min: 1, max: 20 })}-${Date.now()}`,
      content: {
        objects,
      },
      player,
      updatedAt: randomDate(sub(new Date(), { weeks: 2 }), new Date()),
    }))
  }
}
