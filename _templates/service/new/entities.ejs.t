---
inject: true
to: src/entities/index.ts
after: export default
---
  <%= h.changeCase.pascal(name) %>,