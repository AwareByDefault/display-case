import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Shared scaffolding for the unit suites: build a throwaway package directory on
 * disk, populate it from a `{ relativePath: contents }` map, and clean it up.
 * Filesystem-backed because the modules under test (config resolution, case
 * discovery, the token scanner, the init scaffolder) all read real files.
 */

/** Make a unique temp directory; the caller is responsible for removing it. */
export async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'dc-test-'))
}

/** Write a map of package-relative paths → file contents, creating parents. */
export async function writeFiles(
  dir: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(dir, rel)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content)
  }
}
