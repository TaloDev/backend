export default async function clearEntities(entities: string[]) {
  for (const entityName of entities) {
    const repo = global.em.getRepository(entityName)
    const items = await repo.findAll()
    await global.em.removeAndFlush(items)
  }
}
