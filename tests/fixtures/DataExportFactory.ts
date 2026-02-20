import { Factory } from 'hefty'
import DataExport, { DataExportStatus } from '../../src/entities/data-export'
import Game from '../../src/entities/game'
import UserFactory from './UserFactory'

export default class DataExportFactory extends Factory<DataExport> {
  private game: Game

  constructor(game: Game) {
    super(DataExport)

    this.game = game
  }

  protected override definition() {
    this.state(async () => {
      const createdByUser = await new UserFactory().one()

      return {
        status: DataExportStatus.REQUESTED,
        createdByUser,
        game: this.game,
      }
    })
  }
}
