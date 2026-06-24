---
"@awarebydefault/display-case": minor
---

Bundle each component separately instead of the whole catalog as one module
graph — removing the precondition for a Bun-bundler segfault on large showcases
(≈100+ cases that transitively import real application code and large vendor
libraries).

- **Dev server**: builds each component's render + SSR bundle the first time that
  component is requested, rather than pre-bundling the whole catalog at startup.
  Startup is now independent of case count. Each build runs in a subprocess, so a
  component whose bundle fails — or even crashes the bundler — is isolated and
  shown as a chrome-free diagnostic (component + source file) while every other
  component keeps serving, and the CPU-bound build never blocks the server.
- **`publish`**: builds the chrome once, then each component into its own
  content-hashed browser + SSR bundle; the production server serves each
  component's own bundle. A large showcase now publishes without crashing.

Behavior note: in the dev preview, switching between two different components now
reloads the preview frame (each component is its own bundle); switching case
variants, tweaks, or theme within a component is still an in-place swap.
