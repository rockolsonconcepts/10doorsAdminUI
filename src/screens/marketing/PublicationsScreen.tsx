import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Channel, ContentAsset, Publication, PublicationStatus } from '@/model/marketing';
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Table, inputClass } from '@/components/ui';
import { formatRelative } from '@/lib/format';
import { TrackedLinkGuide } from './TrackedLinkGuide';

const STATUSES: PublicationStatus[] = ['PENDING', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'];
const STATUS_LABEL: Partial<Record<PublicationStatus, string>> = { CANCELLED: 'BLOCKED / CANCELLED' };
const STATUS_HINT: Partial<Record<PublicationStatus, string>> = {
  CANCELLED: 'Publications the policy guard blocked (reason shown per row) or that were cancelled. Nothing here is expected to be posted.',
};

export function PublicationsScreen() {
  const [status, setStatus] = useState<PublicationStatus>('PENDING');
  const list = useAsync(() => backendApi.publications(status), [status]);
  const channels = useAsync(() => backendApi.channels(), []);
  const [selected, setSelected] = useState<Publication | null>(null);
  const channelFor = (channelId: string | null) => channels.data?.find((c) => c.channelId === channelId) ?? null;

  return (
    <>
      <PageHeader
        title="Publications"
        subtitle="Approved content waiting to be posted (manual channel) and what has already gone out"
        actions={<Button variant="secondary" onClick={list.reload}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      <div className="mb-4 flex gap-2">
        {STATUSES.map((s) => (
          <Button key={s} variant={s === status ? 'primary' : 'secondary'} onClick={() => { setStatus(s); setSelected(null); }}>{STATUS_LABEL[s] ?? s}</Button>
        ))}
      </div>
      {STATUS_HINT[status] && <p className="mb-4 text-sm text-slate-500">{STATUS_HINT[status]}</p>}
      <ErrorNote message={list.error} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card title={`${status} publications`}>
          {list.loading && !list.data ? <Spinner /> : !list.data?.length ? <Empty>No {status.toLowerCase()} publications.</Empty> : (
            <Table head={<><th>Target</th><th>Status</th><th>Created</th><th>Link</th></>}>
              {list.data.map((p) => (
                <tr key={p.publicationId} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${selected?.publicationId === p.publicationId ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`} onClick={() => setSelected(p)}>
                  <td>
                    <div>{p.targetLocation ?? '—'}</div>
                    <div className="text-xs text-slate-500">{channelFor(p.channelId)?.name ?? p.channelId?.slice(0, 8)} · <span className="font-mono">{p.publicationId.slice(0, 8)}</span></div>
                    {p.failureReason && <div className="mt-1 max-w-md text-xs text-red-600">{p.failureReason}</div>}
                  </td>
                  <td><Badge tone={p.publicationStatus === 'PUBLISHED' ? 'good' : p.publicationStatus === 'FAILED' || p.publicationStatus === 'CANCELLED' ? 'bad' : 'warn'}>{p.publicationStatus}</Badge></td>
                  <td className="whitespace-nowrap">{formatRelative(p.createdAtMillis)}</td>
                  <td>{p.externalUrl && <a className="text-blue-600 hover:underline" href={p.externalUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4" /></a>}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Post it">
          {selected ? <PublicationDetail publication={selected} channel={channelFor(selected.channelId)} onSaved={() => { setSelected(null); list.reload(); }} /> : <Empty>Select a publication to see the content and record the result.</Empty>}
        </Card>
      </div>
    </>
  );
}

export function PublicationDetail({ publication, channel, onSaved }: { publication: Publication; channel: Channel | null; onSaved: () => void }) {
  const asset = useAsync(() => (publication.contentAssetId ? backendApi.asset(publication.contentAssetId) : Promise.resolve(null)), [publication.contentAssetId]);
  const [url, setUrl] = useState(publication.externalUrl ?? '');
  const [postId, setPostId] = useState(publication.externalPostId ?? '');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(status: PublicationStatus) {
    setBusy(true);
    setError(null);
    try {
      await backendApi.recordPublicationResult(publication.publicationId, {
        status,
        externalUrl: url || undefined,
        externalPostId: postId || undefined,
        failureReason: status === 'FAILED' ? failure || 'Marked failed by administrator' : undefined,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
        <dt className="text-slate-500">Target</dt><dd>{publication.targetLocation ?? '—'}</dd>
        <dt className="text-slate-500">Channel</dt><dd>{channel ? <>{channel.name} <Badge>{channel.channelType}</Badge> <Badge tone={channel.manualPosting ? 'default' : 'good'}>{channel.manualPosting ? 'manual posting' : 'automated'}</Badge></> : <span className="font-mono text-xs">{publication.channelId}</span>}</dd>
        {publication.failureReason && <><dt className="text-slate-500">{publication.publicationStatus === 'CANCELLED' ? 'Blocked because' : 'Failure'}</dt><dd className="text-red-600">{publication.failureReason}</dd></>}
      </dl>
      {asset.loading ? <Spinner label="Loading content…" /> : asset.data && (
        <AssetEditor asset={asset.data} locked={publication.publicationStatus === 'PUBLISHED'} onSaved={asset.reload} />
      )}
      <TrackedLinkGuide publication={publication} channel={channel} />
      {publication.publicationStatus === 'CANCELLED' && (
        <p className="text-sm text-slate-500">Cancelled by the policy guard, so no PUBLISH action was queued. If you posted it anyway, record the URL below so Learn can pick it up.</p>
      )}
      {channel && !channel.manualPosting && publication.publicationStatus !== 'PUBLISHED' && publication.publicationStatus !== 'FAILED' && (
        <p className="text-sm text-slate-500">Automated channel: the agent posts this itself once the PUBLISH action is approved. Only record a result here if you posted it by hand.</p>
      )}
      {publication.publicationStatus !== 'PUBLISHED' && (
        <div className="space-y-2">
          <div className="font-medium">Record result</div>
          <input className={inputClass} placeholder="URL of the live post" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className={inputClass} placeholder="External post ID (optional)" value={postId} onChange={(e) => setPostId(e.target.value)} />
          <input className={inputClass} placeholder="Failure reason (if it could not be posted)" value={failure} onChange={(e) => setFailure(e.target.value)} />
          <ErrorNote message={error} />
          <div className="flex gap-2">
            <Button disabled={busy || !url} onClick={() => save('PUBLISHED')}>Mark published</Button>
            <Button variant="danger" disabled={busy} onClick={() => save('FAILED')}>Mark failed</Button>
          </div>
        </div>
      )}
    </div>
  );
}

const textareaClass = `${inputClass} min-h-[72px]`;

/**
 * The generated text, editable in place. Saving keeps the LLM version on the asset; once the publication is marked
 * PUBLISHED the pair becomes a voice exemplar for Plan/Draft/Learn, so unpublished edits never teach the agent.
 */
function AssetEditor({ asset, locked, onSaved }: { asset: ContentAsset; locked: boolean; onSaved: () => void }) {
  const [title, setTitle] = useState(asset.title ?? '');
  const [hook, setHook] = useState(asset.hook ?? '');
  const [body, setBody] = useState(asset.body ?? '');
  const [cta, setCta] = useState(asset.callToAction ?? '');
  const [showOriginal, setShowOriginal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(asset.title ?? '');
    setHook(asset.hook ?? '');
    setBody(asset.body ?? '');
    setCta(asset.callToAction ?? '');
  }, [asset]);

  const dirty = title !== (asset.title ?? '') || hook !== (asset.hook ?? '') || body !== (asset.body ?? '') || cta !== (asset.callToAction ?? '');
  const edited = asset.editedAtMillis > 0;

  async function saveText() {
    setBusy(true);
    setError(null);
    try {
      await backendApi.updateAssetText(asset.contentAssetId, { title, hook, body, callToAction: cta });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setTitle(asset.title ?? '');
    setHook(asset.hook ?? '');
    setBody(asset.body ?? '');
    setCta(asset.callToAction ?? '');
  }

  const copy = () => navigator.clipboard.writeText([title, body, cta].filter(Boolean).join('\n\n'));

  if (locked) {
    return (
      <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
        <div className="mb-2 flex items-center gap-2"><span className="font-medium">Published text</span>{edited && <Badge tone="good">your edit · voice example</Badge>}</div>
        {asset.title && <div className="mb-1 font-semibold">{asset.title}</div>}
        {asset.hook && <div className="mb-2 italic text-slate-600 dark:text-slate-300">{asset.hook}</div>}
        <div className="whitespace-pre-wrap">{asset.body}</div>
        {asset.callToAction && <div className="mt-2 font-medium">{asset.callToAction}</div>}
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={copy}>Copy text</Button>
          {edited && <Button variant="secondary" onClick={() => setShowOriginal((v) => !v)}>{showOriginal ? 'Hide' : 'Show'} what the agent wrote</Button>}
        </div>
        {showOriginal && <OriginalText asset={asset} />}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Content {edited && <Badge>edited by you</Badge>}</span>
        {edited && <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setShowOriginal((v) => !v)}>{showOriginal ? 'Hide' : 'Show'} what the agent wrote</button>}
      </div>
      {showOriginal && <OriginalText asset={asset} />}
      <label className="block text-xs text-slate-500">Title
        <input className={`${inputClass} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
      </label>
      <label className="block text-xs text-slate-500">Hook
        <input className={`${inputClass} mt-1`} value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Optional" />
      </label>
      <label className="block text-xs text-slate-500">Body
        <textarea className={`${textareaClass} mt-1`} rows={Math.min(18, Math.max(6, body.split('\n').length + 2))} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="block text-xs text-slate-500">Call to action
        <input className={`${inputClass} mt-1`} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Optional" />
      </label>
      <ErrorNote message={error} />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy || !dirty || !body.trim()} onClick={saveText}>{busy ? 'Saving…' : 'Save edits'}</Button>
        {dirty && <Button variant="secondary" disabled={busy} onClick={reset}>Discard</Button>}
        <Button variant="secondary" onClick={copy}>Copy text</Button>
      </div>
      <p className="text-xs text-slate-500">
        Say it your way — the agent keeps its own version for comparison. Your edit only becomes a tone-and-voice example for future drafts
        once you record this publication as <span className="font-medium">Published</span>; failed or unpublished edits are never used.
      </p>
    </div>
  );
}

function OriginalText({ asset }: { asset: ContentAsset }) {
  return (
    <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
      <div className="mb-1 font-medium uppercase tracking-wide text-slate-400">Agent's version</div>
      {asset.originalTitle && <div className="font-semibold">{asset.originalTitle}</div>}
      {asset.originalHook && <div className="italic">{asset.originalHook}</div>}
      <div className="whitespace-pre-wrap">{asset.originalBody}</div>
      {asset.originalCallToAction && <div className="mt-1 font-medium">{asset.originalCallToAction}</div>}
    </div>
  );
}
