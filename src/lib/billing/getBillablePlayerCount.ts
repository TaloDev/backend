import { EntityManager } from '@mikro-orm/mysql'
import Organisation from '../../entities/organisation'
import PlayerAlias from '../../entities/player-alias'

export default async function getBillablePlayerCount(em: EntityManager, organisation: Organisation): Promise<number> {
  const query = em.qb(PlayerAlias, 'pa')
    .count('pa.player', true)
    .where({
      player: {
        game: { organisation }
      },
      anonymised: false
    })

  return (await query.execute('get')).count
}
