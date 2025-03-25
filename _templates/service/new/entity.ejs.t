---
to: src/entities/<%= name %>.ts
---
import { Entity, PrimaryKey, Property } from '@mikro-orm/mysql'

@Entity()
export default class <%= h.changeCase.pascal(name) %> {
  @PrimaryKey()
  id!: number

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor() {

  }

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt
    }
  }
}
