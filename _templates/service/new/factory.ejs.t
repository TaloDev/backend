---
to: tests/fixtures/<%= h.changeCase.pascal(name) %>Factory.ts
---
import { Factory } from 'hefty'
import casual from 'casual'
import <%= h.changeCase.pascal(name) %> from '../../src/entities/<%= name %>'

export default class <%= h.changeCase.pascal(name) %>Factory extends Factory<<%= h.changeCase.pascal(name) %>> {
  constructor() {
    super(<%= h.changeCase.pascal(name) %>, 'base')
    this.register('base', this.base)
  }

  protected base(): Partial<<%= h.changeCase.pascal(name) %>> {
    return {

    }
  }
}
