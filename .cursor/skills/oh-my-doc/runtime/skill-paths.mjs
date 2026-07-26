import { homedir } from 'node:os';
import { join } from 'node:path';

/** @typedef {'codex' | 'cursor' | 'claude' | 'all'} AgentKind */
/** @typedef {'project' | 'user'} SetupScope */
/** @typedef {Exclude<AgentKind, 'all'>} ConcreteAgent */

/** Official project-relative discovery roots for the `oh-my-doc` skill. */
export const PROJECT_SKILL_ROOTS = {
  cursor: '.cursor/skills/oh-my-doc',
  claude: '.claude/skills/oh-my-doc',
  codex: '.agents/skills/oh-my-doc',
};

/** Official user-scope discovery roots (absolute) for the `oh-my-doc` skill. */
export function userSkillRoot(agent, home = homedir()) {
  switch (agent) {
    case 'cursor':
      return join(home, '.cursor/skills/oh-my-doc');
    case 'claude':
      return join(home, '.claude/skills/oh-my-doc');
    case 'codex':
      return join(home, '.agents/skills/oh-my-doc');
  }
}

export function agentsFor(agent) {
  if (!agent || agent === 'all') return ['codex', 'cursor', 'claude'];
  return [agent];
}

export function skillInstallRoot(agent, scope, projectRoot, home = homedir()) {
  if (scope === 'user') {
    const absolute = userSkillRoot(agent, home);
    return { absolute, displayPath: absolute };
  }
  const relative = PROJECT_SKILL_ROOTS[agent];
  return { absolute: join(projectRoot, relative), displayPath: relative };
}
