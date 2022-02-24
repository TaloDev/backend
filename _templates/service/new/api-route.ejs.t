---
inject: true
to: "<%= (typeof api !== 'undefined') ? 'src/config/api-routes.ts' : null %>"
before: app\.use\(service
---
  app.use(service('/v1/<%= name %>s', new <%= h.changeCase.pascal(name) %>APIService()))