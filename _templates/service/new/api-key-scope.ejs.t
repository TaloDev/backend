---
inject: true
to: "<%= (typeof api !== 'undefined') ? 'src/entities/api-key.ts' : null %>"
after: export enum APIKeyScope
---
  READ_<%= h.changeCase.constantCase(name) %>S = 'read:<%= h.changeCase.camel(name) %>s',
  WRITE_<%= h.changeCase.constantCase(name) %>S = 'write:<%= h.changeCase.camel(name) %>s',