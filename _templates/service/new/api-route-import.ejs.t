---
inject: true
to: src/config/api-routes.ts
after: import \{ service \}
---
import <%= h.changeCase.pascal(name) %>sAPIService from '../services/api/<%= name %>s-api.service'