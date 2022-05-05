import { EntityManager } from '@mikro-orm/core'

export default async function clearEntities(em: EntityManager, entities: string[]) {
  for (const entityName of entities) {
    const repo = em.getRepository(entityName)
    const items = await repo.findAll()
    await repo.removeAndFlush(items)
  }
}
