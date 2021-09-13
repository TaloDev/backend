---
inject: true
to: "<%= (typeof api !== 'undefined') ? 'src/config/api-routes.ts' : null %>"
after: import \{ service \}
---
import <%= h.changeCase.pascal(name) %>sAPIService from '../services/api/<%= name %>s-api.service'