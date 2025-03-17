import { Embeddable, Property } from '@mikro-orm/mysql'

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
