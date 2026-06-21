import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { $ } from 'bun'
import { publish } from '../src/publish'
import { makeTempDir } from '../src/test-helpers'

/**
 * Level 3 of the publish coverage: build the generated Dockerfile into a real
 * image, run it, and confirm the container serves a functional showcase.
 *
 * Docker-gated: the whole suite is skipped (not failed) when Docker is
 * unavailable, so the default test run stays Docker-free. It also lives OUTSIDE
 * the `bun test` discovery root (`src/`, per bunfig) so it never runs in the
 * normal `bun test` / pre-commit path — invoke it explicitly with
 * `bun run test:container`.
 */

const REPO = resolve(import.meta.dir, '..')
const FIXTURE = join(REPO, 'e2e/fixtures/consumer-plain')
const TAG = 'display-case-deploy-test:latest'

async function dockerReady(): Promise<boolean> {
  const v = await $`docker --version`.nothrow().quiet()
  if (v.exitCode !== 0) return false
  // `docker --version` works even when the daemon is down; `docker info` needs it.
  const info = await $`docker info`.nothrow().quiet()
  return info.exitCode === 0
}

const HAS_DOCKER = await dockerReady()
if (!HAS_DOCKER) {
  console.log('• Docker not available — skipping the container deploy test.')
}

// describe.skipIf keeps the suite reported-but-skipped when Docker is absent.
const suite = HAS_DOCKER ? describe : describe.skip

suite('publish: containerized deploy path', () => {
  let out: string
  let containerId = ''

  beforeAll(async () => {
    out = await makeTempDir()
    await publish(FIXTURE, { out })

    // The generated package.json depends on `display-case: latest` from npm.
    // This package isn't published yet, so we substitute a locally-packed
    // tarball into the build context — decoupling the container build from npm
    // publication. Once `display-case` is published, `latest` resolves directly
    // and this substitution is unnecessary.
    const pack = await $`bun pm pack --destination ${out}`
      .cwd(REPO)
      .nothrow()
      .quiet()
    if (pack.exitCode !== 0) {
      throw new Error(`bun pm pack failed: ${pack.stderr.toString()}`)
    }
    const tgz = (await readdir(out)).find((f) => f.endsWith('.tgz'))
    if (!tgz) throw new Error('packed tarball not found in build context')
    const pkgPath = join(out, 'package.json')
    const pkg = (await Bun.file(pkgPath).json()) as {
      dependencies: Record<string, string>
    }
    pkg.dependencies['display-case'] = `./${tgz}`
    await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
  }, 120_000)

  afterAll(async () => {
    if (containerId) await $`docker rm -f ${containerId}`.nothrow().quiet()
    await $`docker rmi -f ${TAG}`.nothrow().quiet()
    if (out) await rm(out, { recursive: true, force: true })
  })

  test('builds the Dockerfile and serves /health + the shell', async () => {
    const build = await $`docker build -t ${TAG} ${out}`.nothrow()
    expect(build.exitCode).toBe(0)

    // Map the container's 3000 to a random free host port on loopback.
    const run = await $`docker run -d --rm -p 127.0.0.1::3000 ${TAG}`
      .nothrow()
      .quiet()
    expect(run.exitCode).toBe(0)
    containerId = run.stdout.toString().trim()

    const portOut = await $`docker port ${containerId} 3000`.nothrow().quiet()
    const mapped = portOut.stdout.toString().trim().split('\n')[0] // 127.0.0.1:49xxx
    const hostPort = mapped.split(':').pop()
    expect(hostPort).toBeTruthy()
    const baseUrl = `http://127.0.0.1:${hostPort}`

    // Poll the health endpoint until the container's server boots (bounded).
    let healthy = false
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`${baseUrl}/health`)
        if (r.ok) {
          healthy = true
          break
        }
      } catch {
        // not up yet
      }
      await Bun.sleep(1000)
    }
    expect(healthy).toBe(true)

    const shell = await fetch(`${baseUrl}/`)
    expect(shell.status).toBe(200)
    expect(await shell.text()).toContain('Plain Consumer')
  }, 600_000)
})
