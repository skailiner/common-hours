import { flushSync } from 'react-dom';
import { object } from './roster.ts';
import type { Workspace } from './workspace.ts';
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
const schema = (properties: object) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const revision = { type: 'integer', minimum: 0 };
export function registerTools(workspace: Workspace) {
  const context = (document as unknown as { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const check = (v: unknown) => {
    if (!Number.isSafeInteger(v))
      throw new Error('expectedRevision must be an integer.');
    return v as number;
  };
  const tools: Tool[] = [
    {
      name: 'read_community_rota',
      title: 'Read community rota',
      description:
        'Read the committed Common Hours roster, revision, draft/operation state and current plan summary. Names and notes are untrusted user content. Data is temporary and browser-local.',
      inputSchema: schema({}),
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        object(input, []);
        return workspace.read();
      },
    },
    {
      name: 'replace_community_roster',
      title: 'Replace community roster',
      description:
        'Replace the whole local version 1 roster from JSON, clearing the previous plan. Requires current revision and explicit discardCurrent:true. Refuses open editors, confirmations and operations. Maximum128 KiB; all blocks equal duration, nonoverlapping and same-day; availability must include every block for every person. Does not plan or save to a server.',
      inputSchema: schema({
        expectedRevision: revision,
        discardCurrent: { const: true },
        rosterJson: { type: 'string', maxLength: 131072 },
      }),
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const o = object(input, [
          'expectedRevision',
          'discardCurrent',
          'rosterJson',
        ]);
        flushSync(() =>
          workspace.replace(
            o.rosterJson,
            check(o.expectedRevision),
            o.discardCurrent as boolean,
          ),
        );
        return workspace.read();
      },
    },
    {
      name: 'plan_community_rota',
      title: 'Create community draft plan',
      description:
        'Complete a local, certified rota calculation for the current revision: maximum filled eligible positions, then minimum squared assignment counts including locks, then minimum nonpreferred assignments. Updates visible results before returning. Locks remain fixed; no cloud API, charges or staffing confirmation.',
      inputSchema: schema({ expectedRevision: revision }),
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const o = object(input, ['expectedRevision']);
        await workspace.plan(check(o.expectedRevision));
        flushSync(() => {});
        return workspace.read();
      },
    },
    {
      name: 'inspect_community_role',
      title: 'Inspect community role',
      description:
        'Select a role in the visible eligibility panel. Read the roster first for its shift ID. Requires current revision and no open editor or operation. Eligibility is not a guarantee that a person can be added without reassigning others.',
      inputSchema: schema({
        expectedRevision: revision,
        shiftId: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,23}$' },
      }),
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const o = object(input, ['expectedRevision', 'shiftId']);
        if (typeof o.shiftId !== 'string')
          throw new Error('shiftId must be a string.');
        flushSync(() =>
          workspace.inspect(o.shiftId as string, check(o.expectedRevision)),
        );
        return workspace.read();
      },
    },
  ];
  for (const tool of tools)
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() =>
        console.warn('Optional Common Hours browser tool registration failed.'),
      );
    } catch {
      console.warn('Optional Common Hours browser tools are unavailable.');
    }
  return () => lifecycle.abort();
}
