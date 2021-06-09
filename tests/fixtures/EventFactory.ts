import { Factory } from 'hefty'
import casual from 'casual'
import Event from '../../src/entities/event'
import Player from '../../src/entities/player'
import { sub } from 'date-fns'
import Prop from '../../src/entities/prop'

export default class EventFactory extends Factory<Event> {
  private availablePlayers: Player[]
  private eventTitles: string[]

  constructor(availablePlayers: Player[]) {
    super(Event, 'base')
    this.register('base', this.base)
    this.register('this week', this.thisWeek)
    this.register('this month', this.thisMonth)
    this.register('this year', this.thisYear)

    this.availablePlayers = availablePlayers
    this.eventTitles = ['Zone Explored', 'Killed By Player', 'Killed By NPC', 'Item Looted', 'Treasure Discovered', 'Levelled up', 'Potion Used', 'Item Crafted', 'Respawned', 'Secret Discovered', 'Item Bought', 'Talked to NPC', 'Killed NPC', 'Killed Player', 'Revived Player', 'Revived by Player']
  }

  protected async base(): Promise<Partial<Event>> {
    const player: Player = casual.random_element(this.availablePlayers)

    const availableProps = ['itemId', 'zoneId', 'treasureId', 'currentLevel', 'timeTaken', 'positionX', 'positionY', 'objectId', 'actionId', 'positionZ', 'currentHealth', 'currentMana', 'currentEnergy', 'npcId']
    const propsCount = casual.integer(0, 4)
    const props: Prop[] = []

    for (let i = 0; i < propsCount; i++) {
      props.push(new Prop(casual.random_element(availableProps), String(casual.integer(0, 999))))
    }

    return {
      name: casual.random_element(this.eventTitles),
      game: player.game,
      playerAlias: casual.random_element(player.aliases.getItems()),
      props
    }
  }

  protected thisWeek(): Partial<Event> {
    return {
      createdAt: this.randomDate(sub(new Date(), { weeks: 1 }), new Date())
    }
  }

  protected thisMonth(): Partial<Event> {
    return {
      createdAt: this.randomDate(sub(new Date(), { months: 1 }), new Date())
    }
  }

  protected thisYear(): Partial<Event> {
    return {
      createdAt: this.randomDate(sub(new Date(), { years: 1 }), new Date())
    }
  }

  private randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  }
}
