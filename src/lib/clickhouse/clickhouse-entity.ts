import { EntityManager } from '@mikro-orm/mysql'

export default class ClickHouseEntity<T, U extends Array<unknown> = [], V extends Array<unknown> = []> {
  constructor() {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  construct(...args: V): this {
    throw new Error('construct must be implemented')
  }

  toInsertable(): T {
    throw new Error('toInsertable must be implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async hydrate(em: EntityManager, data: T, ...args: U): Promise<this> {
    throw new Error('hydrate must be implemented')
  }
}
