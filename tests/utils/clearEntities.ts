import { EntityManager } from '@mikro-orm/mysql'

export default async function clearEntities(entities: string[]) {
  for (const entityName of entities) {
    const repo = (<EntityManager>global.em).getRepository(entityName)
    const items = await repo.findAll()
    await  (<EntityManager>global.em).removeAndFlush(items)
  }
}
