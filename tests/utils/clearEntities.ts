export default async function clearEntities(entities: string[]) {
  for (const entityName of entities) {
    const items = await em.repo(entityName).findAll()
    await em.removeAndFlush(items)
  }
}
