---
'@awarebydefault/display-case': patch
---

Fix duplicate-React in the browser bundle that broke hook-using components
("Invalid hook call … more than one copy of React"). Display Case's client
runtime resolved `react`/`react-dom` from its own install while the consumer's
cases resolved them from the project, so a `bunx` temp install pulled two React
copies. A new `pinReact` bundler plugin forces every `react`/`react-dom`
specifier to resolve from the consumer project, collapsing them to one copy
across the dev browser, dev SSR, and publish browser builds.
