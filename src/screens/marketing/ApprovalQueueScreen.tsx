import { useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { AgentAction } from '@/model/marketing';
import { Badge, Button, Card, Code, Empty, ErrorNote, PageHeader, Spinner, inputClass } from '@/components/ui';
import { formatRelative, labelFor, prettyJson } from '@/lib/format';

export function ApprovalQueueScreen() {
  const pending = useAsync(() => backendApi.pendingActions(), []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function review(action: AgentAction, approved: boolean) {
    setBusy(action.actionId);
    setError(null);
    try {
      await backendApi.reviewAction(action.actionId, approved, notes[action.actionId] ?? '');
      pending.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const groups = groupByType(pending.data ?? []);

  return (
    <>
      <PageHeader
        title="Approval Queue"
        subtitle="Actions the agent proposed that are waiting for a human decision. Nothing is published without approval."
        actions={<Button variant="secondary" onClick={pending.reload}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      <ErrorNote message={pending.error ?? error} />
      {pending.loading && !pending.data ? <Spinner /> : groups.length === 0 ? (
        <Card><Empty>Queue is empty. The agent has nothing awaiting review.</Empty></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([type, actions]) => (
            <Card key={type} title={<span>{labelFor(type)} <Badge>{actions.length}</Badge></span>}>
              <div className="space-y-4">
                {actions.map((a) => (
                  <div key={a.actionId} className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono">{a.actionId}</span>
                      <span>proposed {formatRelative(a.createdAtMillis)}{a.modelUsed ? ` · ${a.modelUsed}` : ''}{a.campaignId ? ` · campaign ${a.campaignId.slice(0, 8)}` : ''}</span>
                    </div>
                    {a.rationale && <p className="mb-3 text-sm"><span className="font-medium">Why: </span>{a.rationale}</p>}
                    {a.guardReason && <p className="mb-3 text-sm text-amber-700 dark:text-amber-300"><span className="font-medium">Guard: </span>{a.guardReason}</p>}
                    <ProposedPayload action={a} />
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        className={inputClass}
                        placeholder="Review note (optional)"
                        value={notes[a.actionId] ?? ''}
                        onChange={(e) => setNotes({ ...notes, [a.actionId]: e.target.value })}
                      />
                      <Button disabled={busy === a.actionId} onClick={() => review(a, true)}><Check className="h-4 w-4" /> Approve</Button>
                      <Button variant="danger" disabled={busy === a.actionId} onClick={() => review(a, false)}><X className="h-4 w-4" /> Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function ProposedPayload({ action }: { action: AgentAction }) {
  const parsed = safeParse(action.proposedPayload);
  if (!parsed) return action.proposedPayload ? <Code>{action.proposedPayload}</Code> : null;
  const fields = ['title', 'topic', 'angle', 'hook', 'hypothesis', 'statement', 'name', 'condition', 'action', 'body', 'callToAction', 'targetLocation', 'targetChannelType', 'proposedType']
    .filter((k) => typeof parsed[k] === 'string' && (parsed[k] as string).trim() !== '');
  if (fields.length === 0) return <Code>{prettyJson(action.proposedPayload)}</Code>;
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
        {fields.map((k) => (
          <FieldRow key={k} label={k} value={parsed[k] as string} />
        ))}
      </dl>
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">Raw payload</summary>
        <Code>{prettyJson(action.proposedPayload)}</Code>
      </details>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="capitalize text-slate-500">{label.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
      <dd className={label === 'body' ? 'whitespace-pre-wrap' : ''}>{value}</dd>
    </>
  );
}

function safeParse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function groupByType(actions: AgentAction[]): [string, AgentAction[]][] {
  const map = new Map<string, AgentAction[]>();
  for (const a of actions) map.set(a.actionType, [...(map.get(a.actionType) ?? []), a]);
  return [...map.entries()];
}
