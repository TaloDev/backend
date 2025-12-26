import { Factory } from 'hefty'
import GameChannelStorageProp from '../../src/entities/game-channel-storage-prop'
import GameChannel from '../../src/entities/game-channel'
import { randWord } from '@ngneat/falso'
import PlayerAliasFactory from './PlayerAliasFactory'

export default class GameChannelStoragePropFactory extends Factory<GameChannelStorageProp> {
  private channel: GameChannel

  constructor(channel: GameChannel) {
    super(GameChannelStorageProp)
    this.channel = channel
  }

  protected override definition() {
    this.state(async () => {
      const playerAlias = await new PlayerAliasFactory(this.channel.owner!.player).one()

      return {
        gameChannel: this.channel,
        key: randWord(),
        value: randWord(),
        createdBy: playerAlias,
        lastUpdatedBy: playerAlias
      }
    })
  }
}
