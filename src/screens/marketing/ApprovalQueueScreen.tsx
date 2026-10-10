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

  const groups = groupByType(pending.data ?? []);

  return (
    <>
      <PageHeader
        title="Approval Queue"
        subtitle="Actions the agent proposed that are waiting for a human decision. Nothing is published without approval."
        actions={<Button variant="secondary" onClick={pending.reload}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      <ErrorNote message={pending.error} />
      {pending.loading && !pending.data ? <Spinner /> : groups.length === 0 ? (
        <Card><Empty>Queue is empty. The agent has nothing awaiting review.</Empty></Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([type, actions]) => (
            <Card key={type} title={<span>{labelFor(type)} <Badge>{actions.length}</Badge></span>}>
              <div className="space-y-4">
                {actions.map((a) => (
                  <ActionCard key={a.actionId} action={a} channels={channels.data ?? []} onReviewed={pending.reload} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/** One pending action with its readable payload and Approve/Reject controls. */
export function ActionCard({ action: a, channels, onReviewed }: { action: AgentAction; channels: Channel[]; onReviewed: (approved: boolean) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(approved: boolean) {
    setBusy(true);
    setError(null);
    try {
      await backendApi.reviewAction(a.actionId, approved, note);
      onReviewed(approved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-white/10">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span className="font-mono">{a.actionId}</span>
        <span>proposed {formatRelative(a.createdAtMillis)}{a.modelUsed ? ` · ${a.modelUsed}` : ''}{a.campaignId ? ` · campaign ${a.campaignId.slice(0, 8)}` : ''}</span>
      </div>
      {a.rationale && <p className="mb-3 text-sm"><span className="font-medium">Why: </span>{a.rationale}</p>}
      {routingReason(a.guardReason) && <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Why it's here: {routingReason(a.guardReason)}</p>}
      <ProposedPayload action={a} channels={channels} />
      <ErrorNote message={error} />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input className={inputClass} placeholder="Feedback for the agent (optional) — read by future plans, drafts and Learn" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex shrink-0 gap-2">
          <Button disabled={busy} onClick={() => review(true)}><Check className="h-4 w-4" /> Approve</Button>
          <Button variant="danger" disabled={busy} onClick={() => review(false)}><X className="h-4 w-4" /> Reject</Button>
        </div>
      </div>
    </div>
  );
}

/** The guard's fallback verdict applies to every queued item, so only rule-specific routing is worth showing. */
function routingReason(reason: string | null): string | null {
  if (!reason || reason.startsWith('Default:')) return null;
  return reason;
}

const TEXT_FIELDS = ['intent', 'contentType', 'title', 'topic', 'angle', 'hook', 'hypothesis', 'statement', 'name', 'condition', 'action', 'body', 'callToAction', 'mediaPrompt', 'targetLocation', 'targetChannelType', 'proposedType', 'field', 'proposedText', 'evidence'];
const LIST_FIELDS = ['tags', 'channelIds', 'keyPoints'];
const NUMBER_FIELDS = ['sampleSize'];
const LONG_FIELDS = ['body', 'proposedText', 'evidence'];

function ProposedPayload({ action, channels }: { action: AgentAction; channels: Channel[] }) {
  const raw = safeParse(action.proposedPayload);
  if (!raw) return action.proposedPayload ? <Code>{action.proposedPayload}</Code> : null;
  const parsed = flattenDraft(raw);
  const channelName = (id: unknown) => channels.find((c) => c.channelId === id)?.name ?? (typeof id === 'string' ? id.slice(0, 8) : '');
  const rows: { label: string; value: string; body?: boolean }[] = [];
  if (typeof parsed.channelId === 'string') rows.push({ label: 'channel', value: channelName(parsed.channelId) });
  for (const k of TEXT_FIELDS) {
    const v = parsed[k];
    if (typeof v === 'string' && v.trim() !== '') rows.push({ label: k, value: v, body: LONG_FIELDS.includes(k) });
  }
  for (const k of NUMBER_FIELDS) {
    const v = parsed[k];
    if (typeof v === 'number') rows.push({ label: k, value: String(v) });
  }
  for (const k of LIST_FIELDS) {
    const v = parsed[k];
    if (Array.isArray(v) && v.length > 0) {
      rows.push({ label: k, value: v.map((x) => (k === 'channelIds' ? channelName(x) : String(x))).join(', ') });
    }
  }
  const assetId = typeof parsed.contentAssetId === 'string' && typeof parsed.body !== 'string' ? parsed.contentAssetId : null;
  const trackedUrl = typeof parsed.trackedUrl === 'string' && parsed.trackedUrl.trim() !== '' ? parsed.trackedUrl : null;
  if (rows.length === 0 && !assetId && !trackedUrl) return <Code>{prettyJson(action.proposedPayload)}</Code>;
  return (
    <div className="space-y-2">
      {action.actionType === 'UPDATE_CHARTER' && (
        <p className="text-xs text-slate-500">
          Learn found the same correction across several published edits or review notes and proposes writing it into the Content Charter.
          Approving replaces the named charter field with the proposed text (banned phrases are appended); rejecting leaves the charter unchanged.
        </p>
      )}
      <dl className="grid grid-cols-[6rem_1fr] gap-y-1 sm:grid-cols-[9rem_1fr] text-sm">
        {rows.map((r) => (
          <FieldRow key={r.label} label={r.label} value={r.value} long={r.body} />
        ))}
        {trackedUrl && (
          <>
            <dt className="text-slate-500">Link</dt>
            <dd className="min-w-0 break-all"><a href={trackedUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">{trackedUrl}</a></dd>
          </>
        )}
      </dl>
      {assetId && <AssetPreview assetId={assetId} />}
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">Raw payload</summary>
        <Code>{prettyJson(action.proposedPayload)}</Code>
      </details>
    </div>
  );
}

/** Publish payloads only reference the asset; load it so the reviewer sees the post being scheduled. */
function AssetPreview({ assetId }: { assetId: string }) {
  const asset = useAsync(() => backendApi.asset(assetId), [assetId]);
  if (asset.loading && !asset.data) return <Spinner label="Loading post…" />;
  if (asset.error) return <ErrorNote message={`Couldn't load the post: ${asset.error}`} />;
  const a = asset.data;
  if (!a) return null;
  const rows = ([['title', a.title], ['hook', a.hook], ['body', a.body], ['callToAction', a.callToAction]] as const)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '');
  if (rows.length === 0) return <p className="text-sm text-slate-500">This post has no text yet.</p>;
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Post to be scheduled</p>
      <dl className="grid grid-cols-[6rem_1fr] gap-y-1 sm:grid-cols-[9rem_1fr] text-sm">
        {rows.map(([label, value]) => (
          <FieldRow key={label} label={label} value={value as string} long={label === 'body'} />
        ))}
      </dl>
    </div>
  );
}

function FieldRow({ label, value, long }: { label: string; value: string; long?: boolean }) {
  return (
    <>
      <dt className="capitalize text-slate-500">{label.replace(/([A-Z])/g, ' $1').toLowerCase()}</dt>
      <dd className={long ? 'whitespace-pre-wrap' : ''}>{value}</dd>
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
