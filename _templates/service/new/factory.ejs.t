---
to: tests/fixtures/<%= h.changeCase.pascal(name) %>Factory.ts
---
import { Factory } from 'hefty'
import <%= h.changeCase.pascal(name) %> from '../../src/entities/<%= name %>'

export default class <%= h.changeCase.pascal(name) %>Factory extends Factory<<%= h.changeCase.pascal(name) %>> {
  constructor() {
    super(<%= h.changeCase.pascal(name) %>)
  }

  protected definition(): void {
    this.state(() => ({
      // TODO
    }))
  }
}
