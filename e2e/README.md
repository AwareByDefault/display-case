# Display Case — end-to-end tests

Playwright tests that drive the Display Case **browse chrome** against a real,
running Display Case server. They are co-located with the package (rather than in
the repo-wide `e2e/` suite) so everything Display Case needs travels with it when
the package is extracted to its own repo.

## Running

From `packages/display-case/`:

```bash
bun run e2e:install   # one-time: install the Chromium browser
bun run e2e           # run the suite (boots the server itself)
bun run e2e:headed    # same, with a visible browser
```

The Playwright config (`../playwright.config.ts`) starts the server via its
`webServer` block — `bun src/cli.ts . --port=3190`, pointed at this package,
which dogfoods its own design system. No app stack (Mongo/API/web) is involved.
Override the port with `DISPLAY_CASE_PORT` for parallel/worktree runs.

## Conventions

- **Locators are test ids.** The chrome carries `data-testid` attributes defined
  in [`../src/ui/test-ids.ts`](../src/ui/test-ids.ts) (`DcTestIds`). Specs import
  that module and pass the constants/builders to `getByTestId` — never hardcoded
  strings — so a renamed id is a compile-time concern, not a silent break.
- **Ids come from the manifest.** Specs read component/case ids from the live
  `/manifest.json` (see [`helpers.ts`](helpers.ts)) instead of hardcoding them,
  so they survive renames and reordering of the showcased components.
- **Mind the Primer.** When a Primer is configured the chrome lands on it at
  `/`; use `gotoLibrary(page)` to reach the Cases view.

## What's covered

| File                  | Concern                                                        |
| --------------------- | ------------------------------------------------------------- |
| `manifest.spec.ts`    | server contract: `/health`, `/manifest.json`, `/render`       |
| `chrome.spec.ts`      | shell loads (title, nav rail); theme toggle                   |
| `navigation.spec.ts`  | component/case selection, deep links, disclosure chevrons     |
| `docs-panel.spec.ts`  | placard-doc panel open/close and `?docs=1` deep link           |
| `primer.spec.ts`     | Primer ↔ Cases mode switch                                    |
