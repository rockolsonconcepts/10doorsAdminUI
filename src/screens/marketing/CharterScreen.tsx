import { useEffect, useState } from 'react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { ContentCharter } from '@/model/marketing';
import { Button, Card, ErrorNote, Spinner, inputClass } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

type TextField = 'productName' | 'voice' | 'audienceTruths' | 'contentPrinciples' | 'productMentionGuidance' | 'goodExample' | 'badExample';

const textFields: { key: TextField; label: string; hint: string; rows: number }[] = [
  { key: 'productName', label: 'Product name', hint: 'Used to count product mentions in drafts.', rows: 1 },
  { key: 'voice', label: 'Voice', hint: 'Who is writing and how they sound. The model treats this as binding.', rows: 3 },
  { key: 'audienceTruths', label: 'Audience truths', hint: 'The real situations, frustrations and questions readers have. One per line.', rows: 6 },
  { key: 'contentPrinciples', label: 'Content principles', hint: 'How a piece must be built (lead with the situation, be complete without a click, ...).', rows: 6 },
  { key: 'productMentionGuidance', label: 'Product mention guidance', hint: 'When and how the product may appear in non-promotional content.', rows: 4 },
  { key: 'goodExample', label: 'Good example', hint: 'A short piece that shows the voice done right.', rows: 6 },
  { key: 'badExample', label: 'Bad example', hint: 'A short piece that shows what to avoid.', rows: 4 },
];

function parsePhrases(json: string | null): string {
  if (!json) return '';
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String).join('\n') : json;
  } catch {
    return json;
  }
}

function toPhrasesJson(lines: string): string {
  return JSON.stringify(lines.split('\n').map((l) => l.trim()).filter(Boolean));
}

export function CharterScreen() {
  const charter = useAsync(() => backendApi.charter(), []);
  const [form, setForm] = useState<ContentCharter | null>(null);
  const [phrases, setPhrases] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (charter.data) {
      setForm(charter.data);
      setPhrases(parsePhrases(charter.data.bannedPhrases));
    }
  }, [charter.data]);

  const update = (patch: Partial<ContentCharter>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await backendApi.saveCharter({ ...form, bannedPhrases: toPhrasesJson(phrases) });
      setForm(saved);
      setPhrases(parsePhrases(saved.bannedPhrases));
      setSavedAt(Date.now());
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (charter.loading || !form) return <Spinner label="Loading charter…" />;

  const persisted = Boolean(form.contentCharterId);
  const sharePct = form.maxPromotionalShare == null ? '' : String(Math.round(form.maxPromotionalShare * 100));

  return (
    <div className="space-y-5">
      <ErrorNote message={charter.error} />
      <Card
        title="Content charter"
        actions={
          <>
            {savedAt && <span className="text-xs text-slate-500">Saved {formatDateTime(savedAt)}</span>}
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save charter'}</Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          The charter is sent with every planning and drafting request and its limits are enforced by the guard.
          {persisted
            ? ` Last updated ${formatDateTime(form.updatedAtMillis)}.`
            : ' Showing built-in defaults; saving creates the persisted charter.'}
        </p>
        <ErrorNote message={saveError} />
        <div className="grid gap-4 lg:grid-cols-2">
          {textFields.map((f) => (
            <label key={f.key} className={f.rows > 3 ? 'lg:col-span-1' : 'lg:col-span-2'}>
              <span className="text-sm font-medium">{f.label}</span>
              <span className="block text-xs text-slate-500">{f.hint}</span>
              {f.rows === 1 ? (
                <input className={`${inputClass} mt-1`} value={form[f.key] ?? ''} onChange={(e) => update({ [f.key]: e.target.value })} />
              ) : (
                <textarea className={`${inputClass} mt-1 font-mono text-xs`} rows={f.rows} value={form[f.key] ?? ''} onChange={(e) => update({ [f.key]: e.target.value })} />
              )}
            </label>
          ))}
          <label>
            <span className="text-sm font-medium">Banned phrases</span>
            <span className="block text-xs text-slate-500">One per line, case-insensitive. Any draft containing one is rejected before review.</span>
            <textarea className={`${inputClass} mt-1 font-mono text-xs`} rows={6} value={phrases} onChange={(e) => setPhrases(e.target.value)} />
          </label>
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Max promotional share (%)</span>
              <span className="block text-xs text-slate-500">Upper bound on PROMOTE posts per channel over the trailing 7 days. 20 means at most 1 in 5.</span>
              <input
                type="number" min={0} max={100} step={1}
                className={`${inputClass} mt-1 w-32`}
                value={sharePct}
                onChange={(e) => update({ maxPromotionalShare: e.target.value === '' ? null : Number(e.target.value) / 100 })}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Max product mentions (non-PROMOTE)</span>
              <span className="block text-xs text-slate-500">Drafts with intent EDUCATE / STORY / DISCUSSION / ANSWER that name the product more often than this are rejected.</span>
              <input
                type="number" min={0} step={1}
                className={`${inputClass} mt-1 w-32`}
                value={form.maxProductMentions}
                onChange={(e) => update({ maxProductMentions: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}
