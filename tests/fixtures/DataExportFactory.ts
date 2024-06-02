import { Factory } from 'hefty'
import DataExport, { DataExportStatus } from '../../src/entities/data-export.js'
import Game from '../../src/entities/game.js'
import UserFactory from './UserFactory.js'

export default class DataExportFactory extends Factory<DataExport> {
  private game: Game

  constructor(game: Game) {
    super(DataExport, 'base')
    this.register('base', this.base)

    this.game = game
  }

  protected async base(): Promise<Partial<DataExport>> {
    const createdByUser = await new UserFactory().one()

    return {
      status: DataExportStatus.SENT,
      createdByUser,
      game: this.game
    }
  }
}
