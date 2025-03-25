import { EntityManager } from '@mikro-orm/mysql'

export default class ClickHouseEntity<T, U extends Array<unknown> = [], V extends Array<unknown> = []> {
  constructor() {}

  construct(..._args: U): this {
    throw new Error('construct must be implemented')
  }

  toInsertable(): T {
    throw new Error('toInsertable must be implemented')
  }

  async hydrate(_em: EntityManager, _data: T, ..._args: V): Promise<this> {
    throw new Error('hydrate must be implemented')
  }
}
