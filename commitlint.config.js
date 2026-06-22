// Conventional Commits, enforced on commit-msg by the husky hook.
//
// semantic-release derives the next version + changelog from these commit types:
//   fix:      → patch release     feat:     → minor release
//   feat!: / "BREAKING CHANGE:" footer → major release
//   chore/docs/refactor/test/ci/build/perf/style → no release on their own.
// See contributing/releasing.md.
export default { extends: ['@commitlint/config-conventional'] }
