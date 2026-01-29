import { describe, it, expect, beforeEach } from 'vitest'
import { DocsRegistry } from '../../../src/lib/docs/docs-registry'
import assert from 'node:assert'

describe('DocsRegistry', () => {
  let registry: DocsRegistry

  beforeEach(() => {
    registry = new DocsRegistry()
  })

  it('should initialize with empty services', () => {
    const json = registry.toJSON()
    expect(json.services).toEqual([])
  })

  it('should add a service', () => {
    registry.addService('TestService', '/test')

    const json = registry.toJSON()
    expect(json.services).toHaveLength(1)

    assert(json.services[0])
    expect(json.services[0].name).toBe('TestService')
    expect(json.services[0].path).toBe('/test')
  })

  it('should add a route to a service', () => {
    registry.addRoute({
      key: 'PlayerAPI',
      method: 'get',
      path: '/v1/players/identify',
      docs: {
        description: 'Identify a player'
      }
    })

    const json = registry.toJSON()
    expect(json.services).toHaveLength(1)

    assert(json.services[0])
    expect(json.services[0].name).toBe('PlayerAPI')
    expect(json.services[0].routes).toHaveLength(1)

    assert(json.services[0].routes[0])
    expect(json.services[0].routes[0].method).toBe('get')
    expect(json.services[0].routes[0].path).toBe('/v1/players/identify')
    expect(json.services[0].routes[0].description).toBe('Identify a player')
  })

  it('should add parameters to a route', () => {
    registry.addRoute({
      key: 'PlayerAPI',
      method: 'get',
      path: '/v1/players/identify',
      docs: {
        description: 'Identify a player',
        params: {
          query: {
            service: {
              required: true,
              description: 'Service name'
            },
            identifier: {
              required: true,
              description: 'Player identifier'
            }
          }
        }
      }
    })

    const json = registry.toJSON()
    assert(json.services[0])

    const route = json.services[0].routes[0]
    assert(route)

    expect(route.params).toHaveLength(2)
    assert(route.params?.[0])

    expect(route.params[0].type).toBe('query')
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
            sample: { service: 'steam', identifier: '12345' }
          }
        ]
      }
    })

    const json = registry.toJSON()
    assert(json.services[0])

    const route = json.services[0].routes[0]
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
      path: '/v1/players/identify'
    })

    registry.addRoute({
      key: 'PlayerAPI',
      method: 'post',
      path: '/v1/players'
    })

    const json = registry.toJSON()
    expect(json.services).toHaveLength(1)

    assert(json.services[0])
    expect(json.services[0].routes).toHaveLength(2)
  })

  it('should update existing service when adding with same name', () => {
    registry.addService('TestService', '/test')
    registry.addService('TestService', '/test/v2')

    const json = registry.toJSON()
    expect(json.services).toHaveLength(1)

    assert(json.services[0])
    expect(json.services[0].path).toBe('/test/v2')
  })
})
