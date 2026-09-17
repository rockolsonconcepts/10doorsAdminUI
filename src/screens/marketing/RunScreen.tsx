import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, ChevronRight, Circle, Loader2, Play, RefreshCw } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { AgentStepName, AgentStepStatus, Channel, Publication } from '@/model/marketing';
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner } from '@/components/ui';
import { describeCron, formatDateTime, formatRelative, formatUntil } from '@/lib/format';
import { ActionCard } from './ApprovalQueueScreen';
import { PublicationDetail } from './PublicationsScreen';
import { ObservationForm } from './ListeningScreen';

const IDEA_TYPES = ['CREATE_IDEA'];
const DRAFT_TYPES = ['CREATE_CONTENT'];
const PUBLISH_TYPES = ['PUBLISH'];
const EXECUTE_POLL_MS = 3000;
const EXECUTE_POLL_MAX_MS = 90_000;

export function RunScreen() {
  const system = useAsync(() => backendApi.system(), []);
  const objectives = useAsync(() => backendApi.objectives(), []);
  const segments = useAsync(() => backendApi.segments(), []);
  const channels = useAsync(() => backendApi.channels(), []);
  const campaigns = useAsync(() => backendApi.campaigns(), []);
  const charter = useAsync(() => backendApi.charter(), []);
  const workflow = useAsync(() => backendApi.agentWorkflow(), []);
  const pending = useAsync(() => backendApi.pendingActions(), []);
  const publications = useAsync(() => backendApi.publications('PENDING'), []);
  const observations = useAsync(() => backendApi.observations('NEW'), []);

  const [executing, setExecuting] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const reloadQueue = () => {
    pending.reload();
    publications.reload();
    workflow.reload();
  };

  useEffect(() => () => { if (pollTimer.current) window.clearTimeout(pollTimer.current); }, []);

  /** Trigger Execute (or another step) and keep refreshing until the scheduler reports the run finished. */
  async function runStep(step: AgentStepName, label: string) {
    if (pollTimer.current) window.clearTimeout(pollTimer.current);
    setRunError(null);
    setExecuting(label);
    const startedAt = Date.now();
    const before = (workflow.data ?? []).find((x) => x.step === step)?.lastFinishedAtMillis ?? null;
    try {
      await backendApi.runAgentStep(step);
    } catch (e) {
      // Busy (another tick running) is fine: we still poll for the outcome. Anything else is surfaced.
      const msg = e instanceof Error ? e.message : String(e);
      if (!/already running/i.test(msg)) {
        setRunError(msg);
        setExecuting(null);
        return;
      }
    }
    const poll = async () => {
      let finished = false;
      try {
        const steps = await backendApi.agentWorkflow();
        const s = steps.find((x) => x.step === step);
        finished = !!s && !s.running && s.lastFinishedAtMillis != null && s.lastFinishedAtMillis !== before;
      } catch {
        finished = false;
      }
      if (finished || Date.now() - startedAt > EXECUTE_POLL_MAX_MS) {
        setExecuting(null);
        reloadQueue();
        observations.reload();
        return;
      }
      pollTimer.current = window.setTimeout(poll, EXECUTE_POLL_MS);
    };
    pollTimer.current = window.setTimeout(poll, EXECUTE_POLL_MS);
  }

  function onReviewed(approved: boolean) {
    pending.reload();
    if (approved) void runStep('EXECUTE', 'Executing your approval…');
  }

  const agent = system.data?.marketingAgent;
  const steps = workflow.data ?? [];
  const stepFor = (name: AgentStepName) => steps.find((s) => s.step === name);
  const actions = pending.data ?? [];
  const ideas = actions.filter((a) => IDEA_TYPES.includes(a.actionType));
  const drafts = actions.filter((a) => DRAFT_TYPES.includes(a.actionType));
  const publishApprovals = actions.filter((a) => PUBLISH_TYPES.includes(a.actionType));
  const learnItems = actions.filter((a) => ![...IDEA_TYPES, ...DRAFT_TYPES, ...PUBLISH_TYPES].includes(a.actionType));
  const toPost = publications.data ?? [];
  const channelList = channels.data ?? [];
  const channelFor = (id: string | null) => channelList.find((c) => c.channelId === id) ?? null;

  const checklist: ChecklistItem[] = [
    { label: 'Marketing agent enabled', ok: agent?.enabled ?? null, required: true, to: '/', hint: 'Set marketing.agent.enabled=true in the backend and redeploy.' },
    { label: 'OpenAI key configured', ok: agent?.openAiConfigured ?? null, required: true, to: '/', hint: 'Set marketing.agent.openai.api-key, then use Test connection on Overview.' },
    { label: 'At least one objective', ok: objectives.data ? objectives.data.length > 0 : null, required: true, to: '/marketing/reference', hint: 'Reference Data → Add objective (what the marketing should move: registrations, traffic…).' },
    { label: 'At least one audience segment', ok: segments.data ? segments.data.some((s) => s.active) : null, required: false, to: '/marketing/reference', hint: 'Recommended: segments with pain points are what make the content relatable.' },
    { label: 'An enabled channel', ok: channels.data ? channels.data.some((c) => c.enabled) : null, required: true, to: '/marketing/reference', hint: 'Reference Data → Add channel (Reddit, Threads, Substack…) and leave it enabled.' },
    { label: 'An ACTIVE campaign', ok: campaigns.data ? campaigns.data.some((c) => c.campaignStatus === 'ACTIVE') : null, required: true, to: '/marketing/reference', hint: 'Reference Data → Add campaign (objective + segments + channels), then Activate it.' },
    { label: 'Content charter filled in', ok: charter.data ? !!(charter.data.voice && charter.data.voice.trim()) : null, required: false, to: '/marketing/charter', hint: 'Recommended: voice, audience truths and banned phrases keep drafts from sounding like ads.' },
  ];
  const requiredDone = checklist.filter((c) => c.required).every((c) => c.ok === true);
  const loadingSetup = checklist.some((c) => c.ok === null);

  const loadError = [system, objectives, segments, channels, campaigns, charter, workflow, pending, publications, observations]
    .map((s) => s.error).find((e) => e) ?? null;

  return (
    <>
      <PageHeader
        title="Run the agent"
        subtitle="The whole loop, top to bottom. Each step shows what it is waiting on and the one thing you can do about it."
        actions={
          <Button variant="secondary" onClick={() => { reloadQueue(); observations.reload(); system.reload(); }}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <ErrorNote message={loadError ?? runError} />
      {executing && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          <Loader2 className="h-4 w-4 animate-spin" /> {executing} This screen refreshes when the step finishes.
        </div>
      )}

      <div className="space-y-4">
        <Step n={1} title="Setup" status={loadingSetup ? <Badge>Checking…</Badge> : requiredDone ? <Badge tone="good">Ready</Badge> : <Badge tone="warn">Incomplete</Badge>}
          summary={requiredDone ? 'Everything the planner needs exists. Optional items below are worth doing.' : 'The planner skips until every required item is green.'}
          defaultOpen={!requiredDone}>
          <ul className="space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                <StatusDot ok={c.ok} required={c.required} />
                <div className="flex-1">
                  <Link to={c.to} className="hover:underline">{c.label}</Link>
                  {!c.required && <span className="ml-2 text-xs text-slate-400">optional</span>}
                  {c.ok === false && <div className="text-xs text-slate-500">{c.hint}</div>}
                </div>
                {c.ok === false && <Link to={c.to} className="text-xs text-blue-600 hover:underline">Fix <ArrowRight className="inline h-3 w-3" /></Link>}
              </li>
            ))}
          </ul>
        </Step>

        <Step n={2} title="Observe" status={stepFor('OBSERVE')?.lastOk === false ? <Badge tone="bad">Last run failed</Badge> : agent?.googleAnalyticsConfigured ? <Badge tone="good">App + GA4</Badge> : <Badge>App metrics only</Badge>}
          summary="Snapshots your app's numbers (registrations, units, leases, subscriptions) and GA4 traffic if configured. Plan reads the recent snapshots; Learn compares them against what was posted. Runs on its own; run it now if you want fresh numbers before planning."
          defaultOpen={stepFor('OBSERVE')?.lastOk === false}
          aside={<StepRunner step={stepFor('OBSERVE')} busy={!!executing} onRun={() => runStep('OBSERVE', 'Collecting metrics…')} />}>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2"><StatusDot ok={agent ? true : null} required /><div>App metrics — always collected from the backend database.</div></li>
            <li className="flex items-start gap-2">
              <StatusDot ok={agent?.googleAnalyticsConfigured ?? null} required={false} />
              <div className="flex-1">Google Analytics 4 <span className="ml-2 text-xs text-slate-400">optional</span>
                {agent?.googleAnalyticsConfigured === false && <div className="text-xs text-slate-500">Set marketing.agent.google-analytics.property-id and credentials-json, then use Test connection on Overview.</div>}
              </div>
              {agent?.googleAnalyticsConfigured === false && <Link to="/" className="text-xs text-blue-600 hover:underline">Fix <ArrowRight className="inline h-3 w-3" /></Link>}
            </li>
            {stepFor('OBSERVE')?.lastError && <li className="text-xs text-red-600">{stepFor('OBSERVE')!.lastError}</li>}
          </ul>
        </Step>

        <Step n={3} title="Listen" status={<Badge tone={observations.data?.length ? 'info' : 'default'}>{observations.data?.length ?? 0} new</Badge>}
          summary="Optional. Paste what landlords and tenants are actually asking (Reddit threads, comments, support emails); the next Plan reads every NEW observation."
          defaultOpen={false}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="text-sm">
              {observations.loading ? <Spinner /> : !observations.data?.length ? (
                <Empty>Nothing new. The planner works without this, but relatable posts start with real questions.</Empty>
              ) : (
                <ul className="space-y-2">
                  {observations.data.slice(0, 5).map((o) => (
                    <li key={o.observationId} className="rounded-lg border border-slate-200 p-2 dark:border-white/10">
                      <div className="text-xs text-slate-500">{o.channelType}{o.location ? ` · ${o.location}` : ''}</div>
                      {o.title && <div className="font-medium">{o.title}</div>}
                      <div className="line-clamp-2 text-slate-600 dark:text-slate-300">{o.snippet}</div>
                    </li>
                  ))}
                  {observations.data.length > 5 && <li className="text-xs"><Link className="text-blue-600 hover:underline" to="/marketing/listening">All {observations.data.length} on the Listening screen</Link></li>}
                </ul>
              )}
            </div>
            <ObservationForm channels={channelList} onSaved={observations.reload} />
          </div>
        </Step>

        <Step n={4} title="Plan" status={<QueueBadge count={ideas.length} noun="idea" />}
          summary="Turns your objective, segments, charter and observations into content ideas. Approve the ones worth writing."
          defaultOpen
          aside={<StepRunner step={stepFor('PLAN')} busy={!!executing} onRun={() => runStep('PLAN', 'Planning ideas…')} />}>
          {ideas.length === 0 ? (
            <Empty>{requiredDone ? 'No ideas waiting. Run Plan now or wait for the daily schedule.' : 'Finish Setup first; Plan skips without an ACTIVE campaign and an enabled channel.'}</Empty>
          ) : (
            <div className="space-y-3">{ideas.map((a) => <ActionCard key={a.actionId} action={a} channels={channelList} onReviewed={onReviewed} />)}</div>
          )}
        </Step>

        <Step n={5} title="Draft" status={<QueueBadge count={drafts.length} noun="draft" />}
          summary="Approved ideas become one draft per channel. Approving a draft creates the publication and its tracked link."
          defaultOpen>
          {drafts.length === 0 ? (
            <Empty>No drafts waiting. They appear here within moments of approving an idea.</Empty>
          ) : (
            <div className="space-y-3">{drafts.map((a) => <ActionCard key={a.actionId} action={a} channels={channelList} onReviewed={onReviewed} />)}</div>
          )}
        </Step>

        <Step n={6} title="Publish" status={<QueueBadge count={publishApprovals.length + toPost.length} noun="item" />}
          summary="Approve the publish action, then post the text yourself with its tracked link and record the live URL. All channels are manual today."
          defaultOpen>
          {publishApprovals.length > 0 && (
            <div className="mb-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Awaiting publish approval</div>
              {publishApprovals.map((a) => <ActionCard key={a.actionId} action={a} channels={channelList} onReviewed={onReviewed} />)}
            </div>
          )}
          {toPost.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ready to post</div>
              {toPost.map((p, i) => <PostCard key={p.publicationId} publication={p} channel={channelFor(p.channelId)} defaultOpen={i === 0} onSaved={publications.reload} />)}
            </div>
          )}
          {publishApprovals.length === 0 && toPost.length === 0 && <Empty>Nothing to post. Approved drafts land here.</Empty>}
        </Step>

        <Step n={7} title="Learn" status={<QueueBadge count={learnItems.length} noun="proposal" />}
          summary="Weekly, once posts have results: the agent proposes insights and strategy rules from what performed. Approved rules steer the next plans."
          defaultOpen={learnItems.length > 0}
          aside={<StepRunner step={stepFor('LEARN')} busy={!!executing} onRun={() => runStep('LEARN', 'Analysing results…')} />}>
          {learnItems.length === 0 ? (
            <Empty>No proposals. Learn needs published posts with recorded URLs; it skips otherwise.</Empty>
          ) : (
            <div className="space-y-3">{learnItems.map((a) => <ActionCard key={a.actionId} action={a} channels={channelList} onReviewed={onReviewed} />)}</div>
          )}
        </Step>
      </div>

      <p className="mt-6 text-xs text-slate-500">
        Execute runs {stepFor('EXECUTE') ? describeCron(stepFor('EXECUTE')!.cron) : 'every few minutes'} in the background; this screen runs Execute for you right after each approval.
        Full audit trail on <Link className="text-blue-600 hover:underline" to="/marketing/activity">Agent Activity</Link>.
      </p>
    </>
  );
}

interface ChecklistItem {
  label: string;
  ok: boolean | null;
  required: boolean;
  to: string;
  hint: string;
}

function StatusDot({ ok, required }: { ok: boolean | null; required: boolean }) {
  if (ok === null) return <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-slate-400" />;
  if (ok) return <Check className="mt-0.5 h-4 w-4 text-emerald-600" />;
  return <Circle className={`mt-0.5 h-4 w-4 ${required ? 'text-red-500' : 'text-amber-500'}`} />;
}

function QueueBadge({ count, noun }: { count: number; noun: string }) {
  if (count === 0) return <Badge>nothing waiting</Badge>;
  return <Badge tone="warn">{count} {noun}{count === 1 ? '' : 's'} waiting</Badge>;
}

function Step({ n, title, status, summary, aside, defaultOpen, children }: {
  n: number; title: string; status: ReactNode; summary: string; aside?: ReactNode; defaultOpen: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);
  return (
    <Card className="overflow-hidden">
      <div className="-m-5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">{n}</span>
          <span className="flex-1">
            <span className="flex items-center gap-2">
              <span className="font-semibold">{title}</span>
              {status}
            </span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{summary}</span>
          </span>
          {open ? <ChevronDown className="mt-1 h-4 w-4 text-slate-400" /> : <ChevronRight className="mt-1 h-4 w-4 text-slate-400" />}
        </button>
        {open && (
          <div className="border-t border-slate-200 px-5 py-4 dark:border-white/10">
            {aside && <div className="mb-4">{aside}</div>}
            {children}
          </div>
        )}
      </div>
    </Card>
  );
}

function StepRunner({ step, busy, onRun }: { step: AgentStepStatus | undefined; busy: boolean; onRun: () => void }) {
  if (!step) return null;
  const outcome = step.running ? <Badge tone="info">Running…</Badge>
    : step.lastOk == null ? <Badge>Not run since restart</Badge>
    : step.lastOk ? <Badge tone="good">Last run OK</Badge> : <Badge tone="bad">Last run failed</Badge>;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-white/5">
      <Button variant="secondary" disabled={busy || step.running || !step.nextRunAtMillis} onClick={onRun}><Play className="h-4 w-4" /> Run {step.title.toLowerCase()} now</Button>
      {outcome}
      <span className="text-slate-500">Schedule: {describeCron(step.cron)} ({step.timezone})</span>
      {step.nextRunAtMillis ? <span className="text-slate-500" title={formatDateTime(step.nextRunAtMillis)}>next {formatUntil(step.nextRunAtMillis)}</span> : <span className="text-red-600">agent disabled</span>}
      {step.lastStartedAtMillis && <span className="text-slate-500">last {formatRelative(step.lastStartedAtMillis)}{step.lastTrigger === 'MANUAL' ? ' (manual)' : ''}</span>}
      {step.lastError && <span className="text-red-600">{step.lastError}</span>}
    </div>
  );
}

function PostCard({ publication, channel, defaultOpen, onSaved }: { publication: Publication; channel: Channel | null; defaultOpen: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 dark:border-white/10">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm">
        <span>
          <span className="font-medium">{channel?.name ?? publication.channelId?.slice(0, 8)}</span>
          {channel && <span className="ml-2"><Badge>{channel.channelType}</Badge></span>}
          {publication.targetLocation && <span className="ml-2 text-slate-500">{publication.targetLocation}</span>}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          created {formatRelative(publication.createdAtMillis)}
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-200 px-4 py-3 dark:border-white/10">
          <PublicationDetail publication={publication} channel={channel} onSaved={onSaved} />
        </div>
      )}
    </div>
  );
}
