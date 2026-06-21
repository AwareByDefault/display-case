/**
 * Per-agent conventions for where launch config, skills, and instructions live.
 * Adding a new agent is data, not control flow — `init`/`uninstall` are
 * agent-agnostic and read everything they need from the selected target.
 */
export interface AgentTarget {
  id: string
  /** Launch/run configuration file, relative to the repo root. */
  launchConfigPath: string
  /** Directory the agent loads skills from, relative to the repo root. */
  skillsDir: string
  /**
   * Candidate instruction files in priority order; the first that exists is
   * used, else the first is created.
   */
  instructionsFiles: string[]
}

export const AGENT_TARGETS: Record<string, AgentTarget> = {
  claude: {
    id: 'claude',
    launchConfigPath: '.claude/launch.json',
    skillsDir: '.claude/skills',
    instructionsFiles: ['AGENTS.md', 'CLAUDE.md'],
  },
}

export const DEFAULT_AGENT = 'claude'
