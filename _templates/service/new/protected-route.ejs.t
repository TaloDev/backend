---
inject: true
to: src/config/protected-routes.ts
before: app\.use\(service
---
  app.use(service('<%= h.changeCase.camel(name) %>s', new <%= h.changeCase.pascal(name) %>sService(), {
    prefix: '/<%= name %>s'
  }))
