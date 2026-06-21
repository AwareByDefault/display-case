import { describe, expect, test } from 'bun:test'
import { AGENT_TARGETS, DEFAULT_AGENT } from './agents'

describe('agent targets', () => {
  test('DEFAULT_AGENT points at a registered target', () => {
    expect(AGENT_TARGETS[DEFAULT_AGENT]).toBeDefined()
    expect(AGENT_TARGETS[DEFAULT_AGENT].id).toBe(DEFAULT_AGENT)
  })

  test('the claude target declares launch, skills, and instruction locations', () => {
    const t = AGENT_TARGETS.claude
    expect(t.id).toBe('claude')
    expect(t.launchConfigPath).toBe('.claude/launch.json')
    expect(t.skillsDir).toBe('.claude/skills')
    expect(t.instructionsFiles).toEqual(['AGENTS.md', 'CLAUDE.md'])
  })

  test('every target’s id matches its registry key', () => {
    for (const [key, target] of Object.entries(AGENT_TARGETS)) {
      expect(target.id).toBe(key)
      expect(target.instructionsFiles.length).toBeGreaterThan(0)
    }
  })
})
