import { EntityManager } from '@mikro-orm/core'
import Game from '../../src/entities/game'
import Player from '../../src/entities/player'

export default async (em: EntityManager) => {
  const game1 = await em.getRepository(Game).findOne({ id: 1 })

  const player1 = new Player()
  player1.aliases = { steam: '1' }
  player1.game = game1

  const player2 = new Player()
  player2.aliases = { steam: '2' }
  player2.game = game1

  const game2 = await em.getRepository(Game).findOne({ id: 2 })

  const player3 = new Player()
  player3.aliases = { steam: '3' }
  player3.game = game2

  const game3 = await em.getRepository(Game).findOne({ id: 3 })

  const player4 = new Player()
  player4.aliases = { steam: '4' }
  player4.game = game3

  const game4 = await em.getRepository(Game).findOne({ id: 4 })

  const player5 = new Player()
  player5.aliases = { steam: '5' }
  player5.game = game4

  await em.persistAndFlush([player1, player2, player3, player4, player5])
}
