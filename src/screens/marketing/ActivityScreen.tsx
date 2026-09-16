import { useEffect, useState } from 'react';
import { ArrowRight, Play, RefreshCw } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { AgentAction, AgentStepName, AgentStepStatus, GuardDecision } from '@/model/marketing';
import { Badge, Button, Card, Code, Empty, ErrorNote, PageHeader, Spinner, Stat, Table } from '@/components/ui';
import { formatDateTime, formatRelative, labelFor, prettyJson } from '@/lib/format';

const DAY = 86_400_000;

export function ActivityScreen() {
  const actions = useAsync(() => backendApi.actions(), []);
  const workflow = useAsync(() => backendApi.agentWorkflow(), []);
  const [selected, setSelected] = useState<AgentAction | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [runningStep, setRunningStep] = useState<AgentStepName | null>(null);

  const anyRunning = workflow.data?.some((s) => s.running) ?? false;
  const reloadWorkflow = workflow.reload;
  const reloadActions = actions.reload;
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => { reloadWorkflow(); reloadActions(); }, 3000);
    return () => clearInterval(t);
  }, [anyRunning, reloadWorkflow, reloadActions]);

  const runNow = async (step: AgentStepName) => {
    setRunError(null);
    setRunningStep(step);
    try {
      await backendApi.runAgentStep(step);
      reloadWorkflow();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunningStep(null);
    }
  };

  const all = [...(actions.data ?? [])].sort((a, b) => b.createdAtMillis - a.createdAtMillis);
  const recent = all.filter((a) => a.createdAtMillis >= Date.now() - DAY);
  const tokens = recent.reduce((sum, a) => sum + (a.promptTokens ?? 0) + (a.completionTokens ?? 0), 0);
  const failed = recent.filter((a) => a.executionStatus === 'FAILED').length;
  const blocked = recent.filter((a) => a.guardDecision === 'BLOCKED_BY_POLICY').length;

  return (
    <>
      <PageHeader
        title="Agent Activity"
        subtitle="Audit log of everything the agent proposed, how the guard ruled, and what was executed"
        actions={<Button variant="secondary" onClick={actions.reload}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />
      <ErrorNote message={actions.error} />
      <ErrorNote message={workflow.error} />
      <ErrorNote message={runError} />
      <Card title="Workflow" className="mb-6">
        <p className="mb-4 text-sm text-slate-500">
          Four steps run on a schedule and hand work to each other through the Approval Queue. Nothing is published
          without an approval. Use <span className="font-medium">Run now</span> to skip the wait (e.g. run Plan for fresh
          ideas, then Execute after approving them). Only one step runs at a time.
        </p>
        {workflow.loading && !workflow.data ? <Spinner /> : (
          <div className="grid gap-3 lg:grid-cols-4">
            {(workflow.data ?? []).map((s, i) => (
              <StepCard key={s.step} step={s} last={i === (workflow.data?.length ?? 0) - 1} busy={runningStep !== null || anyRunning} onRun={() => runNow(s.step)} />
            ))}
          </div>
        )}
      </Card>
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Stat label="Actions (24h)" value={recent.length} />
        <Stat label="Tokens (24h)" value={tokens.toLocaleString()} />
        <Stat label="Failed (24h)" value={failed} tone={failed ? 'bad' : 'default'} />
        <Stat label="Blocked by policy (24h)" value={blocked} tone={blocked ? 'warn' : 'default'} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title={`${all.length} actions`}>
          {actions.loading && !actions.data ? <Spinner /> : all.length === 0 ? <Empty>No agent activity recorded yet.</Empty> : (
            <Table head={<><th>When</th><th>Type</th><th>Guard</th><th>Execution</th><th>Tokens</th></>}>
              {all.slice(0, 200).map((a) => (
                <tr key={a.actionId} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${selected?.actionId === a.actionId ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`} onClick={() => setSelected(a)}>
                  <td className="whitespace-nowrap" title={formatDateTime(a.createdAtMillis)}>{formatRelative(a.createdAtMillis)}</td>
                  <td>{labelFor(a.actionType)}</td>
                  <td><Badge tone={guardTone(a.guardDecision)}>{a.guardDecision}</Badge></td>
                  <td><Badge tone={a.executionStatus === 'FAILED' ? 'bad' : a.executionStatus === 'EXECUTED' ? 'good' : 'default'}>{a.executionStatus}</Badge></td>
                  <td>{a.promptTokens || a.completionTokens ? ((a.promptTokens ?? 0) + (a.completionTokens ?? 0)).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Detail">
          {!selected ? <Empty>Select an action.</Empty> : (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
                <dt className="text-slate-500">Action</dt><dd className="font-mono text-xs">{selected.actionId}</dd>
                <dt className="text-slate-500">Type</dt><dd>{labelFor(selected.actionType)}</dd>
                <dt className="text-slate-500">Target</dt><dd className="font-mono text-xs">{selected.targetEntityType} {selected.targetEntityId}</dd>
                <dt className="text-slate-500">Guard</dt><dd>{selected.guardDecision}{selected.guardReason ? ` — ${selected.guardReason}` : ''}</dd>
                <dt className="text-slate-500">Reviewed</dt><dd>{selected.reviewedBy ? `${selected.reviewedBy} · ${formatDateTime(selected.reviewedAtMillis)}` : '—'}</dd>
                <dt className="text-slate-500">Executed</dt><dd>{selected.executionStatus}{selected.executedAtMillis ? ` · ${formatDateTime(selected.executedAtMillis)}` : ''}</dd>
                {selected.failureReason && <><dt className="text-slate-500">Failure</dt><dd className="text-red-600">{selected.failureReason}</dd></>}
                <dt className="text-slate-500">Model</dt><dd>{selected.modelUsed ?? '—'} {selected.promptTokens != null && <span className="text-slate-500">({selected.promptTokens} in / {selected.completionTokens} out)</span>}</dd>
              </dl>
              {selected.rationale && <p><span className="font-medium">Rationale: </span>{selected.rationale}</p>}
              {selected.proposedPayload && <Code>{prettyJson(selected.proposedPayload)}</Code>}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function StepCard({ step, last, busy, onRun }: { step: AgentStepStatus; last: boolean; busy: boolean; onRun: () => void }) {
  const outcome = step.running ? <Badge tone="info">Running…</Badge>
    : step.lastOk == null ? <Badge>Not run since start</Badge>
    : step.lastOk ? <Badge tone="good">OK</Badge> : <Badge tone="bad">Failed</Badge>;
  return (
    <div className="relative flex flex-col rounded-lg border border-slate-200 p-4 text-sm dark:border-white/10">
      {!last && <ArrowRight className="absolute -right-3 top-5 hidden h-4 w-4 text-slate-400 lg:block" />}
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold">{step.title}</h3>
        {outcome}
      </div>
      <p className="mb-3 flex-1 text-xs text-slate-600 dark:text-slate-300">{step.description}</p>
      <dl className="mb-3 grid grid-cols-[4.5rem_1fr] gap-y-0.5 text-xs">
        <dt className="text-slate-500">Schedule</dt><dd>{describeCron(step.cron)} <span className="text-slate-400">({step.timezone})</span></dd>
        <dt className="text-slate-500">Next run</dt><dd>{step.nextRunAtMillis ? <span title={formatDateTime(step.nextRunAtMillis)}>{formatUntil(step.nextRunAtMillis)}</span> : 'agent disabled'}</dd>
        <dt className="text-slate-500">Last run</dt>
        <dd>
          {step.lastStartedAtMillis ? <span title={formatDateTime(step.lastStartedAtMillis)}>{formatRelative(step.lastStartedAtMillis)}{step.lastTrigger === 'MANUAL' ? ' (manual)' : ''}</span> : '—'}
          {step.lastError && <div className="text-red-600">{step.lastError}</div>}
        </dd>
      </dl>
      <Button variant="secondary" disabled={busy || !step.nextRunAtMillis} onClick={onRun}>
        <Play className="h-4 w-4" /> Run now
      </Button>
    </div>
  );
}

function formatUntil(millis: number): string {
  const s = Math.max(0, Math.round((millis - Date.now()) / 1000));
  if (s < 60) return 'in <1 min';
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `in ${h}h ${m % 60}m`;
  return `in ${Math.floor(h / 24)} days`;
}

function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 6) return cron;
  const [sec, min, hour, dom, , dow] = parts;
  const time = (h: string, m: string) => `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  if (sec === '0' && min.startsWith('*/') && hour === '*') return `every ${min.slice(2)} min`;
  if (sec === '0' && hour.startsWith('*/') && min !== '*') return `every ${hour.slice(2)} h at :${min.padStart(2, '0')}`;
  if (/^\d+$/.test(min) && /^\d+$/.test(hour) && dom === '*') {
    if (dow === '*' || dow === '?') return `daily ${time(hour, min)}`;
    return `${dow.charAt(0) + dow.slice(1).toLowerCase()} ${time(hour, min)}`;
  }
  return cron;
}

function guardTone(d: GuardDecision): 'default' | 'good' | 'warn' | 'bad' | 'info' {
  switch (d) {
    case 'APPROVED': case 'AUTO_APPROVED': return 'good';
    case 'PENDING_REVIEW': return 'warn';
    case 'REJECTED': case 'BLOCKED_BY_POLICY': return 'bad';
    default: return 'default';
  }
}
