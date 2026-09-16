import { FormEvent, ReactNode, useState } from 'react';
import { backendApi } from '@/integration/backendapi';
import { AudienceSegment, Campaign, Channel, CHANNEL_TYPES, MarketingObjective, OBJECTIVE_TYPES } from '@/model/marketing';
import { Button, ErrorNote, inputClass } from '@/components/ui';

const textareaClass = `${inputClass} min-h-[72px]`;

/** Splits a "one per line" textarea into a JSON array string, as the backend stores list fields. */
function linesToJson(text: string): string {
  return JSON.stringify(text.split('\n').map((l) => l.trim()).filter(Boolean));
}

function toMillis(date: string): number {
  return date ? new Date(`${date}T00:00:00`).getTime() : 0;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function AddPanel({ label, children, onSubmit, submitLabel, disabled }: {
  label: string;
  children: ReactNode;
  onSubmit: () => Promise<void>;
  submitLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>{label}</Button>;
  }
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-white/10">
      {children}
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || disabled}>{busy ? 'Saving…' : submitLabel}</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

export function AddObjectiveForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('REGISTRATION');
  const [target, setTarget] = useState('');
  const [baseline, setBaseline] = useState('');
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(plusDaysIso(90));

  return (
    <AddPanel label="Add objective" submitLabel="Create objective" disabled={!name} onSubmit={async () => {
      const objective: Partial<MarketingObjective> & { startDateMillis: number; endDateMillis: number } = {
        name,
        description: description || null,
        type,
        targetValue: target ? Number(target) : null,
        baselineValue: baseline ? Number(baseline) : null,
        status: 'ACTIVE',
        startDateMillis: toMillis(start),
        endDateMillis: toMillis(end),
      };
      await backendApi.createObjective(objective);
      setName(''); setDescription(''); setTarget(''); setBaseline('');
      onCreated();
    }}>
      <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 50 landlord signups this quarter" required /></Field>
      <Field label="Description"><textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Type">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            {OBJECTIVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Target"><input className={inputClass} type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="50" /></Field>
        <Field label="Baseline"><input className={inputClass} type="number" value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="0" /></Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Start"><input className={inputClass} type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End"><input className={inputClass} type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
    </AddPanel>
  );
}

export function AddSegmentForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [painPoints, setPainPoints] = useState('');
  const [interests, setInterests] = useState('');

  return (
    <AddPanel label="Add audience segment" submitLabel="Create segment" disabled={!name} onSubmit={async () => {
      const segment: Partial<AudienceSegment> = {
        name,
        description: description || null,
        painPoints: linesToJson(painPoints),
        interests: linesToJson(interests),
      };
      await backendApi.createSegment(segment);
      setName(''); setDescription(''); setPainPoints(''); setInterests('');
      onCreated();
    }}>
      <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. First-time landlords with 1–3 units" required /></Field>
      <Field label="Who they are"><textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Self-managing, inherited or accidental landlords; no property manager; do everything in spreadsheets and texts." /></Field>
      <Field label="Pain points (one per line — real situations, the more specific the better)">
        <textarea className={textareaClass} value={painPoints} onChange={(e) => setPainPoints(e.target.value)} placeholder={'Tenant paid rent by Zelle with no memo and I can\'t tell which unit\nNot sure if I can charge a late fee in my state\nFirst time serving a notice, terrified of doing it wrong'} />
      </Field>
      <Field label="Interests / questions they search for (one per line)">
        <textarea className={textareaClass} value={interests} onChange={(e) => setInterests(e.target.value)} placeholder={'late rent letter template\nsecurity deposit deductions\nhow to screen a tenant'} />
      </Field>
    </AddPanel>
  );
}

export function AddChannelForm({ onCreated }: { onCreated: () => void }) {
  const [channelType, setChannelType] = useState<string>('THREADS');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [maxPostsPerDay, setMaxPostsPerDay] = useState('1');

  return (
    <AddPanel label="Add channel" submitLabel="Create channel" disabled={!name} onSubmit={async () => {
      const channel: Partial<Channel> = {
        channelType,
        name,
        handle: handle || null,
        enabled: true,
        capabilities: JSON.stringify(['PUBLISH_POST']),
        maxPostsPerDay: Number(maxPostsPerDay) || 1,
      };
      await backendApi.createChannel(channel);
      setName(''); setHandle('');
      onCreated();
    }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Type">
          <select className={inputClass} value={channelType} onChange={(e) => setChannelType(e.target.value)}>
            {CHANNEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Posts per day cap"><input className={inputClass} type="number" min={1} value={maxPostsPerDay} onChange={(e) => setMaxPostsPerDay(e.target.value)} /></Field>
      </div>
      <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Threads – @10doors" required /></Field>
      <Field label="Handle / location"><input className={inputClass} value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@10doors, r/Landlord, …" /></Field>
      <p className="text-xs text-slate-500">Channels are manual until an adapter exists: the agent drafts, you post and record the result.</p>
    </AddPanel>
  );
}

export function AddCampaignForm({ objectives, segments, channels, onCreated }: {
  objectives: MarketingObjective[];
  segments: AudienceSegment[];
  channels: Channel[];
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [objectiveId, setObjectiveId] = useState(objectives[0]?.objectiveId ?? '');
  const [segmentIds, setSegmentIds] = useState<string[]>([]);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(plusDaysIso(60));

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  return (
    <AddPanel label="Add campaign" submitLabel="Create campaign" disabled={!name || !objectiveId} onSubmit={async () => {
      const campaign: Partial<Campaign> = {
        name,
        description: description || null,
        hypothesis: hypothesis || null,
        objectiveId: objectiveId || null,
        campaignStatus: 'ACTIVE',
        startDateMillis: toMillis(start),
        endDateMillis: toMillis(end),
      };
      await backendApi.createCampaign(campaign, segmentIds, channelIds);
      setName(''); setDescription(''); setHypothesis(''); setSegmentIds([]); setChannelIds([]);
      onCreated();
    }}>
      {!objectives.length && <ErrorNote message="Create an objective first — a campaign must belong to one." />}
      <Field label="Name"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Late rent season" required /></Field>
      <Field label="Objective">
        <select className={inputClass} value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)}>
          {objectives.map((o) => <option key={o.objectiveId} value={o.objectiveId}>{o.name}</option>)}
        </select>
      </Field>
      <Field label="Hypothesis (what you expect to learn)"><textarea className={textareaClass} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Stories about the first late-rent conversation get more saves and profile visits than tips lists." /></Field>
      <Field label="Description"><textarea className={textareaClass} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Start"><input className={inputClass} type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="End"><input className={inputClass} type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1 text-xs text-slate-500 dark:text-slate-400">Audience segments</legend>
          {!segments.length && <p className="text-xs text-slate-400">None yet.</p>}
          {segments.map((s) => (
            <label key={s.audienceSegmentId} className="flex items-center gap-2 py-0.5">
              <input type="checkbox" checked={segmentIds.includes(s.audienceSegmentId)} onChange={() => toggle(segmentIds, s.audienceSegmentId, setSegmentIds)} />
              <span>{s.name}</span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-xs text-slate-500 dark:text-slate-400">Channels</legend>
          {!channels.length && <p className="text-xs text-slate-400">None yet.</p>}
          {channels.map((c) => (
            <label key={c.channelId} className="flex items-center gap-2 py-0.5">
              <input type="checkbox" checked={channelIds.includes(c.channelId)} onChange={() => toggle(channelIds, c.channelId, setChannelIds)} />
              <span>{c.name}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </AddPanel>
  );
}
