---
inject: true
to: src/entities/index.ts
before: import
---
import <%= h.changeCase.pascal(name) %> from './<%= name %>'