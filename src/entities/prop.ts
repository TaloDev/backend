import { Embeddable, Property } from '@mikro-orm/core'

@Embeddable()
export default class Prop {
  @Property()
  key: string

  @Property()
  value: string|null

  constructor(key: string, value?: string) {
    this.key = key
    this.value = value
  }
}
