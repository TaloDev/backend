import type { Breadcrumb, ErrorEvent, RequestEventData } from '@sentry/node'

const KEPT_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'content-length',
  'content-type',
  'user-agent',
  'x-talo-client',
])

function stripQuery(url: string) {
  return url.split('?')[0]
}

function scrubRequest(request?: RequestEventData) {
  if (!request) {
    return
  }

  if (request.url) {
    request.url = stripQuery(request.url)
  }

  if (request.headers) {
    request.headers = Object.fromEntries(
      Object.entries(request.headers).filter(([name]) => KEPT_HEADERS.has(name.toLowerCase())),
    )
  }

  delete request.query_string
  delete request.cookies
  delete request.data
}

function scrubBreadcrumbs(breadcrumbs?: Breadcrumb[]) {
  for (const crumb of breadcrumbs ?? []) {
    const data = crumb.data

    if (typeof data?.url === 'string') {
      data.url = stripQuery(data.url)
    }
  }
}

export function scrubEvent<T extends Pick<ErrorEvent, 'request' | 'breadcrumbs'>>(event: T): T {
  scrubRequest(event.request)
  scrubBreadcrumbs(event.breadcrumbs)

  return event
}
