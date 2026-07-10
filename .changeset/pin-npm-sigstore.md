---
---

CI only: pin the release workflow's npm to 11.18.0 instead of `npm@latest`, since
npm 12.0.0 broke `sigstore` bundling and made provenance publish fail. No package
change.
