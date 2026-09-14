import { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Channel, Publication, PublicationStatus } from '@/model/marketing';
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Table, inputClass } from '@/components/ui';
import { formatRelative } from '@/lib/format';
import { TrackedLinkGuide } from './TrackedLinkGuide';

const STATUSES: PublicationStatus[] = ['PENDING', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED'];

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
          <Button key={s} variant={s === status ? 'primary' : 'secondary'} onClick={() => { setStatus(s); setSelected(null); }}>{s}</Button>
        ))}
      </div>
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
                  </td>
                  <td><Badge tone={p.publicationStatus === 'PUBLISHED' ? 'good' : p.publicationStatus === 'FAILED' ? 'bad' : 'warn'}>{p.publicationStatus}</Badge></td>
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

function PublicationDetail({ publication, channel, onSaved }: { publication: Publication; channel: Channel | null; onSaved: () => void }) {
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
        <dt className="text-slate-500">Channel</dt><dd>{channel ? <>{channel.name} <Badge>{channel.channelType}</Badge></> : <span className="font-mono text-xs">{publication.channelId}</span>}</dd>
        {publication.failureReason && <><dt className="text-slate-500">Failure</dt><dd className="text-red-600">{publication.failureReason}</dd></>}
      </dl>
      {asset.loading ? <Spinner label="Loading content…" /> : asset.data && (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
          {asset.data.title && <div className="mb-1 font-semibold">{asset.data.title}</div>}
          {asset.data.hook && <div className="mb-2 italic text-slate-600 dark:text-slate-300">{asset.data.hook}</div>}
          <div className="whitespace-pre-wrap">{asset.data.body}</div>
          {asset.data.callToAction && <div className="mt-2 font-medium">{asset.data.callToAction}</div>}
          <Button variant="secondary" className="mt-3" onClick={() => navigator.clipboard.writeText([asset.data?.title, asset.data?.body, asset.data?.callToAction].filter(Boolean).join('\n\n'))}>Copy text</Button>
        </div>
      )}
      <TrackedLinkGuide publication={publication} channel={channel} />
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
