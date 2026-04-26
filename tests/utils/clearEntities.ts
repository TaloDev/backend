import { EntityClass } from '@mikro-orm/mysql'

export async function clearEntities(entities: EntityClass[]) {
  for (const entity of entities) {
    await em.nativeDelete(entity, {})
  }
}
