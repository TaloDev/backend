import { scrubEvent } from '../../../src/lib/tracing/scrubEvent.js'

function makeEvent() {
  return {
    request: {
      method: 'GET',
      url: '/v1/players/identify?service=email&identifier=jane@doe.com',
      query_string: { service: 'email', identifier: 'jane@doe.com' },
      cookies: { session: 'abc' },
      headers: {
        authorization: 'Bearer player-session-token',
        cookie: 'session=abc',
        'content-type': 'application/json',
        'user-agent': 'talo-unity/1.0',
        'x-talo-client': 'client-1.0.0',
      },
      data: { identifiers: [{ service: 'email', identifier: 'jane@doe.com' }] },
    },
    breadcrumbs: [{ category: 'http', data: { url: 'https://api.steampowered.com?steamid=123' } }],
  }
}

describe('scrubEvent', () => {
  it('should strip the query string from the request url', () => {
    const event = scrubEvent(makeEvent())

    expect(event.request?.url).toBe('/v1/players/identify')
  })

  it('should drop the query string object', () => {
    const event = scrubEvent(makeEvent())

    expect(event.request).not.toHaveProperty('query_string')
  })

  it('should drop player cookies', () => {
    const event = scrubEvent(makeEvent())

    expect(event.request).not.toHaveProperty('cookies')
  })

  it('should drop the request body', () => {
    const event = scrubEvent(makeEvent())

    expect(event.request).not.toHaveProperty('data')
  })

  it('should keep a whitelisted header', () => {
    const event = scrubEvent(makeEvent())

    expect(event.request?.headers).toMatchObject({
      'content-type': 'application/json',
      'user-agent': 'talo-unity/1.0',
      'x-talo-client': 'client-1.0.0',
    })
  })

  it('should drop auth and cookie headers', () => {
    const event = scrubEvent(makeEvent())

    expect(event.request?.headers).not.toHaveProperty('authorization')
    expect(event.request?.headers).not.toHaveProperty('cookie')
  })

  it('should strip the query string from breadcrumb urls', () => {
    const event = scrubEvent(makeEvent())

    expect(event.breadcrumbs?.[0].data?.url).toBe('https://api.steampowered.com')
  })

  it('should handle an event with no request or breadcrumbs', () => {
    expect(scrubEvent({})).toStrictEqual({})
  })
})
