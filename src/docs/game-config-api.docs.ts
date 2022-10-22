import GameConfigAPIService from '../services/api/game-config-api.service'
import APIDocs from './api-docs'

const GameConfigAPIDocs: APIDocs<GameConfigAPIService> = {
  index: {
    description: 'Get the live config for the game',
    samples: [
      {
        title: 'Sample response',
        sample: {
          config: [
            { key: 'xpRate', value: '1.5' },
            { key: 'maxLevel', value: '80' },
            { key: 'halloweenEventEnabled', value: 'false' }
          ]
        }
      }
    ]
  }
}

export default GameConfigAPIDocs
