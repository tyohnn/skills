/**
 * Local MDX/Fumadocs adapter marker.
 * Filesystem adopt/new/check/sync stay in runtime/adopt.mjs and friends;
 * the CLI routes `ssot: local` there directly to avoid import cycles.
 */
export function createLocalAdapter() {
  return {
    ssot: 'local',
  };
}
