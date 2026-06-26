---
"@awarebydefault/display-case": patch
---

Deliver React once in a published showcase instead of inlining it into every
bundle. The catalog is split into one isolated browser bundle per component (the
crash-containment design), and each previously carried its own ~150 KB React copy —
so the published assets duplicated React N+ times and a client browsing N components
downloaded N copies. React is now built once into a shared, content-hashed vendor
bundle that the chrome and every per-component bundle reference via an `<script
type="importmap">` (React is marked external in those builds); it works for both the
host-served build and the static export. Measured on a 35-component showcase:
per-component bundles drop ~191 KB → ~6 KB and total published assets ~7.2 MB →
~1.2 MB, with React downloaded once site-wide. Adds the `publishing` "shared runtime
delivered once" requirement.
