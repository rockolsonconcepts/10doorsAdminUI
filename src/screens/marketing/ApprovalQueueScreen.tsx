import { useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { AgentAction, Channel } from '@/model/marketing';
import { Badge, Button, Card, Code, Empty, ErrorNote, PageHeader, Spinner, inputClass } from '@/components/ui';
import { formatRelative, labelFor, prettyJson } from '@/lib/format';

export function ApprovalQueueScreen() {
  const pending = useAsync(() => backendApi.pendingActions(), []);
  const channels = useAsync(() => backendApi.channels(), []);
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
                    <ProposedPayload action={a} channels={channels.data ?? []} />
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

const TEXT_FIELDS = ['intent', 'contentType', 'title', 'topic', 'angle', 'hook', 'hypothesis', 'statement', 'name', 'condition', 'action', 'body', 'callToAction', 'mediaPrompt', 'targetLocation', 'targetChannelType', 'proposedType'];
const LIST_FIELDS = ['tags', 'channelIds', 'keyPoints'];

function ProposedPayload({ action, channels }: { action: AgentAction; channels: Channel[] }) {
  const raw = safeParse(action.proposedPayload);
  if (!raw) return action.proposedPayload ? <Code>{action.proposedPayload}</Code> : null;
  const parsed = flattenDraft(raw);
  const channelName = (id: unknown) => channels.find((c) => c.channelId === id)?.name ?? (typeof id === 'string' ? id.slice(0, 8) : '');
  const rows: { label: string; value: string; body?: boolean }[] = [];
  if (typeof parsed.channelId === 'string') rows.push({ label: 'channel', value: channelName(parsed.channelId) });
  for (const k of TEXT_FIELDS) {
    const v = parsed[k];
    if (typeof v === 'string' && v.trim() !== '') rows.push({ label: k, value: v, body: k === 'body' });
  }
  for (const k of LIST_FIELDS) {
    const v = parsed[k];
    if (Array.isArray(v) && v.length > 0) {
      rows.push({ label: k, value: v.map((x) => (k === 'channelIds' ? channelName(x) : String(x))).join(', ') });
    }
  }
  if (rows.length === 0) return <Code>{prettyJson(action.proposedPayload)}</Code>;
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
        {rows.map((r) => (
          <FieldRow key={r.label} label={r.label} value={r.value} />
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

/** CREATE_CONTENT payloads nest the asset under `draft`; lift it so the fields render like ideas do. */
function flattenDraft(parsed: Record<string, unknown>): Record<string, unknown> {
  const draft = parsed.draft;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return parsed;
  const rest = Object.fromEntries(Object.entries(parsed).filter(([k]) => k !== 'draft'));
  return { ...rest, ...(draft as Record<string, unknown>) };
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
