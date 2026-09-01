import type { ApplyResult, ScriptLine, World } from './types';
import { applyCommand } from './engine';
import { createWorld } from './repo';

export interface TimelineEntry {
  line: ScriptLine;
  /** World state *after* this line executed. */
  world: World;
  result: Omit<ApplyResult, 'world'>;
}

export interface Timeline {
  initial: World;
  entries: TimelineEntry[];
}

export function buildTimeline(lines: ScriptLine[], initial: World = createWorld()): Timeline {
  const entries: TimelineEntry[] = [];
  let world = initial;

  for (const line of lines) {
    if (line.error) {
      entries.push({
        line,
        world,
        result: {
          ok: false,
          level: 'error',
          message: `parse error: ${line.error}`,
          explain: 'This line could not be understood, so nothing happened.',
          effects: { newCommits: [], transferredCommits: [], movedRefs: [], orphanedCommits: [] },
        },
      });
      continue;
    }
    if (!line.command) continue;
    const { world: next, ...result } = applyCommand(world, line.command);
    world = next;
    entries.push({ line, world, result });
  }

  return { initial, entries };
}

/** World state after `index` steps (0 = nothing executed yet). */
export function worldAt(timeline: Timeline, index: number): World {
  if (index <= 0) return timeline.initial;
  const entry = timeline.entries[Math.min(index, timeline.entries.length) - 1];
  return entry ? entry.world : timeline.initial;
}
