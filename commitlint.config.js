// Conventional Commits, enforced on commit-msg by the husky hook.
//
// This keeps commit history (and squash / PR titles) tidy. It no longer drives
// releases: versioning is decoupled from commit messages and comes from the
// Changeset file each PR includes (patch/minor/major). See
// contributing/releasing.md.
export default { extends: ['@commitlint/config-conventional'] }
