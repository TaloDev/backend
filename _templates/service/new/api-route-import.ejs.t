---
inject: true
to: "<%= (typeof api !== 'undefined') ? 'src/config/api-routes.ts' : null %>"
after: import \{ service \}
---
import <%= h.changeCase.pascal(name) %>APIService from '../services/api/<%= name %>-api.service'