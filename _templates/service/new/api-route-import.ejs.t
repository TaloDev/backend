---
inject: true
to: src/config/api-routes.ts
after: import \{ service \}
---
import <%= h.changeCase.pascal(name) %>APIService from '../services/api/<%= name %>-api.service'