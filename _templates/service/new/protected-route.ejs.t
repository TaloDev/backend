---
inject: true
to: src/config/protected-routes.ts
before: app\.use\(service
---
  app.use(service('/<%= name %>s', new <%= h.changeCase.pascal(name) %>Service()))