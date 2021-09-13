---
inject: true
to: "<%= (typeof api !== 'undefined') ? 'src/config/api-routes.ts' : null %>"
before: app\.use\(service
---
  app.use(service('<%= h.changeCase.camel(name) %>s-api', new <%= h.changeCase.pascal(name) %>sAPIService(), {
    prefix: '/v1/<%= name %>s'
  }))
