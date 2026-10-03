export default class ClickHouseEntity<T, U extends Array<unknown> = []> {
  constructor() {}

  construct(..._args: U): this {
    throw new Error('construct must be implemented')
  }

  toInsertable(): T {
    throw new Error('toInsertable must be implemented')
  }
}
