import { EntityManager } from '@mikro-orm/core'

async function truncateTables(em: EntityManager) {
  await em.getConnection().execute('set FOREIGN_KEY_CHECKS=0;')

  const lines = await em.getConnection().execute('select concat(\'truncate table \', table_name) from information_schema.tables where table_schema = ?;', [process.env.DB_NAME])
  const commands = lines.map((line) => Object.values(line)[0])

  for (const command of commands) {
    if (!command.includes('mikro_orm_migrations')) {
      await em.getConnection().execute(`${command};`)
    }
  }

  await em.getConnection().execute('set FOREIGN_KEY_CHECKS=1;')
}

export default async function clearEntities(em: EntityManager, entities: string[] = []) {
  if (entities.length === 0) {
    await truncateTables(em)
    return
  }

  for (const entityName of entities) {
    const repo = em.getRepository(entityName)
    const items = await repo.findAll()
    await repo.removeAndFlush(items)
  }
}
