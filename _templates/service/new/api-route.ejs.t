---
inject: true
to: src/config/api-routes.ts
before: app\.use\(service
---
  app.use(service('<%= h.changeCase.camel(name) %>s-api', new <%= h.changeCase.pascal(name) %>APIService(), {
    prefix: '/v1/<%= name %>s'
  }))
