import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/decorators/es'
import Game from './game.js'

export const EventFunnelPropOps = [
  'set',
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'between',
  'contains',
] as const

export type EventFunnelPropOp = (typeof EventFunnelPropOps)[number]

export type EventFunnelPropRule = {
  key: string
  op: EventFunnelPropOp
  value: string[]
}

export type EventFunnelStepProps = {
  ruleMode: 'and' | 'or'
  rules: EventFunnelPropRule[]
}

export type EventFunnelStep = {
  name: string
  props: EventFunnelStepProps
}

@Entity()
export default class EventFunnel {
  @PrimaryKey()
  id!: number

  @Property()
  name!: string

  @Property({ type: 'json' })
  steps: EventFunnelStep[] = []

  @Property()
  maxGap!: number

  @ManyToOne(() => Game)
  game: Game

  @Property()
  createdAt: Date = new Date()

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  constructor(game: Game) {
    this.game = game
  }

  static getCacheKey(game: Game, funnelId: number) {
    return `event-funnel-${game.id}-${funnelId}`
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      steps: this.steps,
      maxGap: this.maxGap,
      updatedAt: this.updatedAt,
    }
  }
}
