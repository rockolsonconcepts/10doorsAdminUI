import { useState } from 'react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Channel, Publication } from '@/model/marketing';
import { Button, ErrorNote, inputClass } from '@/components/ui';

const textareaClass = `${inputClass} min-h-[120px]`;

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Logs a post you wrote and published yourself on any channel. It is saved as PUBLISHED, so Learn and the Plan
 * duplicate check see it, and (while "Use as voice example" is on) Plan and Draft use it as an example of your voice.
 */
export function LogPostForm({ channels, onSaved, onCancel }: { channels: Channel[]; onSaved: (p: Publication) => void; onCancel: () => void }) {
  const campaigns = useAsync(() => backendApi.campaigns(), []);
  const [channelId, setChannelId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [hook, setHook] = useState('');
  const [body, setBody] = useState('');
  const [cta, setCta] = useState('');
  const [url, setUrl] = useState('');
  const [postedOn, setPostedOn] = useState(today());
  const [useAsVoice, setUseAsVoice] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = !!channelId && !!body.trim() && !!url.trim();

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const saved = await backendApi.logOperatorPost({
        channelId,
        campaignId: campaignId || undefined,
        targetLocation: location || undefined,
        title: title || undefined,
        hook: hook || undefined,
        body,
        callToAction: cta || undefined,
        externalUrl: url,
        publishedAtMillis: postedOn ? new Date(`${postedOn}T12:00:00`).getTime() : undefined,
        useAsVoiceExemplar: useAsVoice,
      });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-slate-500">Already posted something you wrote yourself? Add it here so the agent can learn from it. You can enter its engagement numbers after saving.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs text-slate-500">Channel
          <select className={`${inputClass} mt-1`} value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">Choose a channel…</option>
            {channels.map((c) => <option key={c.channelId} value={c.channelId}>{c.name} ({c.channelType})</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-500">Campaign
          <select className={`${inputClass} mt-1`} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Active on this channel</option>
            {(campaigns.data ?? []).map((c) => <option key={c.campaignId} value={c.campaignId}>{c.name} · {c.campaignStatus}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-500">URL of the live post
          <input className={`${inputClass} mt-1`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        <label className="block text-xs text-slate-500">Posted on
          <input className={`${inputClass} mt-1`} type="date" max={today()} value={postedOn} onChange={(e) => setPostedOn(e.target.value)} />
        </label>
      </div>
      <label className="block text-xs text-slate-500">Where (optional)
        <input className={`${inputClass} mt-1`} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. a subreddit or BiggerPockets forum" />
      </label>
      <label className="block text-xs text-slate-500">Title
        <input className={`${inputClass} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
      </label>
      <label className="block text-xs text-slate-500">Hook
        <input className={`${inputClass} mt-1`} value={hook} onChange={(e) => setHook(e.target.value)} placeholder="Optional: the opening line" />
      </label>
      <label className="block text-xs text-slate-500">Body
        <textarea className={`${textareaClass} mt-1`} rows={Math.min(18, Math.max(6, body.split('\n').length + 2))} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Paste the post text" />
      </label>
      <label className="block text-xs text-slate-500">Call to action
        <input className={`${inputClass} mt-1`} value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Optional" />
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" className="mt-0.5" checked={useAsVoice} onChange={(e) => setUseAsVoice(e.target.checked)} />
        <span>
          <span className="font-medium">Use as voice example</span>
          <span className="block text-xs text-slate-500">Plan and Draft will write in the style of this post. Untick it if this post isn't how you want the agent to sound. Learn and the duplicate check use it either way.</span>
        </span>
      </label>
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !ready} onClick={save}>{busy ? 'Saving…' : 'Save post'}</Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
