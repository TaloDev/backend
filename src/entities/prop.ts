import { Embeddable, Property } from '@mikro-orm/core'

@Embeddable()
export default class Prop {
  @Property()
  key: string
  
  @Property()
  value: string|null

  constructor(key: any, value: any) {
    this.key = String(key)
    this.value = value !== null ? String(value) : value
  }
}
