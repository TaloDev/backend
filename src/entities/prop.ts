import { Embeddable, Property } from '@mikro-orm/mysql'

export const MAX_KEY_LENGTH = 128
export const MAX_VALUE_LENGTH = 512

@Embeddable()
export default class Prop {
  @Property()
  key: string

  @Property()
  value: string

  constructor(key: string, value: string) {
    this.key = key
    this.value = value
  }
}
