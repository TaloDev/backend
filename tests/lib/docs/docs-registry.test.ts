import assert from 'node:assert'
import { describe, it, expect, beforeEach } from 'vitest'
import { DocsRegistry } from '../../../src/lib/docs/docs-registry'

describe('DocsRegistry', () => {
  let registry: DocsRegistry

  beforeEach(() => {
    registry = new DocsRegistry()
  })

  it('should initialize with empty services', () => {
    const services = registry.getServices()
    expect(services).toEqual([])
  })

  it('should add a route to a service', () => {
    registry.addRoute({
      key: 'PlayerAPI',
      method: 'get',
      path: '/v1/players/identify',
      docs: {
        description: 'Identify a player',
      },
    })

    const services = registry.getServices()
    expect(services).toHaveLength(1)

    assert(services[0])
    expect(services[0].name).toBe('PlayerAPI')
    expect(services[0].routes).toHaveLength(1)

    assert(services[0].routes[0])
    expect(services[0].routes[0].method).toBe('get')
    expect(services[0].routes[0].path).toBe('/v1/players/identify')
    expect(services[0].routes[0].description).toBe('Identify a player')
  })

  it('should add parameters to a route', () => {
    registry.addRoute({
      key: 'PlayerAPI',
      method: 'get',
      path: '/v1/players/identify',
      schema: (z) => ({
        query: z.object({
          service: z.string().meta({ description: 'Service name' }),
          identifier: z.string().meta({ description: 'Player identifier' }),
        }),
      }),
      docs: {
        description: 'Identify a player',
      },
    })

    const services = registry.getServices()
    assert(services[0])

    const route = services[0].routes[0]
    assert(route)

    expect(route.params).toHaveLength(2)
    assert(route.params?.[0])

    expect(route.params[0].location).toBe('query')
    expect(route.params[0].name).toBe('service')
    expect(route.params[0].description).toBe('Service name')
  })

  it('should add samples to a route', () => {
    registry.addRoute({
      key: 'PlayerAPI',
      method: 'get',
      path: '/v1/players/identify',
      docs: {
        samples: [
          {
            title: 'Example request',
            sample: { service: 'steam', identifier: '12345' },
          },
        ],
      },
    })

    const services = registry.getServices()
    assert(services[0])

    const route = services[0].routes[0]
    assert(route)
    assert(route.samples?.[0])

    expect(route.samples).toHaveLength(1)
    expect(route.samples[0].title).toBe('Example request')
    expect(route.samples[0].sample).toEqual({ service: 'steam', identifier: '12345' })
  })

  it('should handle multiple routes in same service', () => {
    registry.addRoute({
      key: 'PlayerAPI',
      method: 'get',
      path: '/v1/players/identify',
    })

    registry.addRoute({
      key: 'PlayerAPI',
      method: 'post',
      path: '/v1/players',
    })

    const services = registry.getServices()
    expect(services).toHaveLength(1)

    assert(services[0])
    expect(services[0].routes).toHaveLength(2)
  })
})
