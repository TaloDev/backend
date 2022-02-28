---
inject: true
to: src/config/protected-routes.ts
after: import \{ service \}
---
import <%= h.changeCase.pascal(name) %>Service from '../services/<%= name %>.service'