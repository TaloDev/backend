import { trustedProxyHops } from '../../../src/lib/proxy/trustedProxyHops.js'

afterAll(() => {
  vi.unstubAllEnvs()
})

describe('trustedProxyHops', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['0', 1],
    ['-2', 1],
    ['1.5', 1],
    ['two', 1],
    ['2', 2],
    ['3', 3],
  ])('reads %s as %i hops', (value, expected) => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', value)
    expect(trustedProxyHops()).toBe(expected)
  })
})
