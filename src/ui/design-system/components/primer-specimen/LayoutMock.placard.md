**LayoutMock** — a miniature three-region wireframe (header over a sidebar + main split); reach for it to sketch an app's shell layout without committing to real chrome.

```tsx
<LayoutMock header="header" sidebar="sidebar" main="main · the stage" />
```

Each region takes any node; omit one to leave it empty. `sidebarWidth` defaults `32%`.
