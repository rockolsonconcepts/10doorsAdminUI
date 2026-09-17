import { useState } from 'react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Channel, ListeningObservation, ObservationStatus, Sentiment } from '@/model/marketing';
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Table, inputClass } from '@/components/ui';

const STATUSES: ObservationStatus[] = ['NEW', 'REVIEWED', 'ACTIONED', 'IGNORED'];
const SENTIMENTS: Sentiment[] = ['NEUTRAL', 'NEGATIVE', 'POSITIVE', 'MIXED'];
const CHANNEL_TYPES = ['REDDIT', 'THREADS', 'INSTAGRAM', 'X', 'FACEBOOK', 'LINKEDIN', 'BLOG', 'EMAIL', 'SEO', 'YOUTUBE', 'TIKTOK'];

const statusTone: Record<ObservationStatus, 'default' | 'good' | 'warn' | 'info'> = {
  NEW: 'info',
  REVIEWED: 'default',
  ACTIONED: 'good',
  IGNORED: 'warn',
};

export function ListeningScreen() {
  const [status, setStatus] = useState<ObservationStatus | ''>('NEW');
  const observations = useAsync(() => backendApi.observations(status || undefined), [status]);
  const channels = useAsync(() => backendApi.channels(), []);

  async function setObservationStatus(id: string, next: ObservationStatus) {
    await backendApi.setObservationStatus(id, next);
    observations.reload();
  }

  return (
    <>
      <PageHeader
        title="Listening"
        subtitle="What the audience is saying. NEW observations are fed into the next daily plan; mark them reviewed or ignored once read."
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Observations"
          actions={
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as ObservationStatus | '')}>
              <option value="">All</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          }
        >
          <ErrorNote message={observations.error} />
          {observations.loading ? <Spinner /> : !observations.data?.length ? (
            <Empty>No observations{status ? ` with status ${status}` : ''}. Paste a thread, question or comment on the right.</Empty>
          ) : (
            <Table head={<><th>Source</th><th>Observation</th><th>Topic</th><th>Status</th><th></th></>}>
              {observations.data.map((o) => (
                <tr key={o.observationId}>
                  <td className="whitespace-nowrap">
                    <Badge>{o.channelType ?? '—'}</Badge>
                    {o.location && <div className="mt-1 text-xs text-slate-500">{o.location}</div>}
                  </td>
                  <td className="max-w-md">
                    {o.title && <div className="font-medium">{o.title}</div>}
                    {o.snippet && <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{o.snippet}</div>}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      {o.author && <span>by {o.author}</span>}
                      {o.externalUrl && <a className="text-blue-600 hover:underline" href={o.externalUrl} target="_blank" rel="noreferrer">source</a>}
                      <span>{new Date(o.observedAtMillis).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td>
                    {o.detectedTopic ?? '—'}
                    {o.sentiment && <div className="text-xs text-slate-500">{o.sentiment}</div>}
                  </td>
                  <td><Badge tone={statusTone[o.observationStatus]}>{o.observationStatus}</Badge></td>
                  <td className="whitespace-nowrap">
                    {o.observationStatus === 'NEW' && (
                      <Button variant="secondary" onClick={() => setObservationStatus(o.observationId, 'REVIEWED')}>Reviewed</Button>
                    )}
                    {o.observationStatus !== 'IGNORED' && (
                      <Button variant="ghost" className="ml-1" onClick={() => setObservationStatus(o.observationId, 'IGNORED')}>Ignore</Button>
                    )}
                    {o.observationStatus === 'IGNORED' && (
                      <Button variant="secondary" onClick={() => setObservationStatus(o.observationId, 'NEW')}>Restore</Button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Add observation">
          <ObservationForm channels={channels.data ?? []} onSaved={observations.reload} />
        </Card>
      </div>
    </>
  );
}

interface FormState {
  channelId: string;
  channelType: string;
  location: string;
  externalUrl: string;
  author: string;
  title: string;
  snippet: string;
  detectedTopic: string;
  sentiment: Sentiment;
}

const emptyForm: FormState = {
  channelId: '',
  channelType: 'REDDIT',
  location: '',
  externalUrl: '',
  author: '',
  title: '',
  snippet: '',
  detectedTopic: '',
  sentiment: 'NEUTRAL',
};

export function ObservationForm({ channels, onSaved }: { channels: Channel[]; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function selectChannel(channelId: string) {
    const channel = channels.find((c) => c.channelId === channelId);
    update({ channelId, channelType: channel?.channelType ?? form.channelType });
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const observation: Partial<ListeningObservation> = {
        channelId: form.channelId || null,
        channelType: form.channelType,
        location: form.location || null,
        externalUrl: form.externalUrl || null,
        externalId: form.externalUrl || null,
        author: form.author || null,
        title: form.title || null,
        snippet: form.snippet,
        detectedTopic: form.detectedTopic || null,
        sentiment: form.sentiment,
        observationStatus: 'NEW',
      };
      await backendApi.recordObservation(observation);
      setForm({ ...emptyForm, channelId: form.channelId, channelType: form.channelType, location: form.location });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-slate-500">
        Paste a post, question or comment you saw. The snippet is what the planner reads; keep it in the author's own words.
      </p>
      <label className="block">
        <span className="text-xs text-slate-500">Channel</span>
        <select className={`${inputClass} mt-1`} value={form.channelId} onChange={(e) => selectChannel(e.target.value)}>
          <option value="">(none — pick a type below)</option>
          {channels.map((c) => <option key={c.channelId} value={c.channelId}>{c.name} · {c.channelType}</option>)}
        </select>
      </label>
      {!form.channelId && (
        <label className="block">
          <span className="text-xs text-slate-500">Channel type</span>
          <select className={`${inputClass} mt-1`} value={form.channelType} onChange={(e) => update({ channelType: e.target.value })}>
            {CHANNEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="text-xs text-slate-500">Location (subreddit, hashtag, group)</span>
        <input className={`${inputClass} mt-1`} placeholder="r/Landlord" value={form.location} onChange={(e) => update({ location: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Source URL</span>
        <input className={`${inputClass} mt-1`} placeholder="https://…" value={form.externalUrl} onChange={(e) => update({ externalUrl: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Title</span>
        <input className={`${inputClass} mt-1`} value={form.title} onChange={(e) => update({ title: e.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Snippet *</span>
        <textarea className={`${inputClass} mt-1`} rows={6} value={form.snippet} onChange={(e) => update({ snippet: e.target.value })} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs text-slate-500">Author</span>
          <input className={`${inputClass} mt-1`} value={form.author} onChange={(e) => update({ author: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Sentiment</span>
          <select className={`${inputClass} mt-1`} value={form.sentiment} onChange={(e) => update({ sentiment: e.target.value as Sentiment })}>
            {SENTIMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-slate-500">Topic (optional)</span>
        <input className={`${inputClass} mt-1`} placeholder="late rent, security deposit, screening…" value={form.detectedTopic} onChange={(e) => update({ detectedTopic: e.target.value })} />
      </label>
      <ErrorNote message={error} />
      <Button onClick={save} disabled={saving || !form.snippet.trim()}>{saving ? 'Saving…' : 'Add observation'}</Button>
    </div>
  );
}
