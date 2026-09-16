import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Badge, Button, Card, ErrorNote, PageHeader, Spinner, Stat } from '@/components/ui';
import { formatDateTime, formatDuration, formatRelative } from '@/lib/format';
import { ConnectionTestResponse, DiagnosticIntegration } from '@/model/marketing';

const HEALTH_POLL_MS = 30_000;

type Health = Awaited<ReturnType<typeof backendApi.health>>;

function ConnectionTest({ integration }: { integration: DiagnosticIntegration }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConnectionTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      setResult(await backendApi.testConnection(integration));
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button variant="secondary" className="px-2 py-0.5 text-xs" onClick={run} disabled={running}>
        {running ? 'Testing…' : 'Test connection'}
      </Button>
      {result && (
        <p className={result.ok ? 'text-xs text-emerald-700 dark:text-emerald-400' : 'text-xs text-red-600 dark:text-red-400'}>
          {result.ok ? 'OK' : 'Failed'} · {result.latencyMillis} ms · {result.detail}
        </p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function OverviewScreen() {
  const system = useAsync(() => backendApi.system(), []);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthAt, setHealthAt] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    const probe = () =>
      backendApi.health().then((h) => {
        if (alive) {
          setHealth(h);
          setHealthAt(Date.now());
        }
      });
    probe();
    const id = setInterval(probe, HEALTH_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const s = system.data;
  const agent = s?.marketingAgent;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Backend health, platform totals and marketing agent state"
        actions={
          <Button variant="secondary" onClick={system.reload}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <ErrorNote message={system.error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Health endpoint"
          value={health ? (health.ok ? 'UP' : 'DOWN') : '…'}
          tone={health ? (health.ok ? 'good' : 'bad') : 'default'}
          hint={health ? `${health.message} · ${health.latencyMs} ms · checked ${formatRelative(healthAt)}` : 'Probing /v1/health'}
        />
        <Stat label="Database" value={s ? (s.databaseUp ? 'UP' : 'DOWN') : '…'} tone={s ? (s.databaseUp ? 'good' : 'bad') : 'default'} hint={s?.databaseProduct} />
        <Stat
          label="Errors (24h / 7d)"
          value={s ? `${s.tracedErrorsLast24h} / ${s.tracedErrorsLast7d}` : '…'}
          tone={s && s.tracedErrorsLast24h > 0 ? 'warn' : 'default'}
          hint={<Link className="text-blue-600 hover:underline" to="/errors">View traced errors</Link>}
        />
        <Stat label="Uptime" value={s ? formatDuration(s.uptimeMillis) : '…'} hint={s ? `since ${formatDateTime(s.startedAtMillis)}` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Runtime">
          {system.loading && !s ? (
            <Spinner />
          ) : s ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Version</dt><dd>{s.applicationVersion}</dd>
              <dt className="text-slate-500">Profiles</dt><dd className="flex gap-1">{s.activeProfiles.map((p) => <Badge key={p} tone="info">{p}</Badge>)}</dd>
              <dt className="text-slate-500">Java</dt><dd>{s.javaVersion}</dd>
              <dt className="text-slate-500">Server time</dt><dd>{formatDateTime(s.serverTimeMillis)}</dd>
            </dl>
          ) : null}
        </Card>

        <Card title="Platform totals">
          {s ? (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">Property managers</dt><dd>{s.propertyManagers}</dd>
              <dt className="text-slate-500">Tenants</dt><dd>{s.tenants}</dd>
              <dt className="text-slate-500">Properties</dt><dd>{s.properties}</dd>
              <dt className="text-slate-500">Clients</dt><dd>{s.clients}</dd>
            </dl>
          ) : <Spinner />}
        </Card>

        <Card
          title="Marketing agent"
          actions={agent && <Badge tone={agent.enabled ? 'good' : 'default'}>{agent.enabled ? 'enabled' : 'disabled'}</Badge>}
          className="lg:col-span-2"
        >
          {agent ? (
            <div className="grid gap-4 md:grid-cols-4">
              <Stat label="Pending review" value={agent.pendingReview} tone={agent.pendingReview > 0 ? 'warn' : 'default'} hint={<Link className="text-blue-600 hover:underline" to="/marketing">Open queue</Link>} />
              <Stat label="Actions (24h)" value={agent.actionsLast24h} hint={agent.lastActionAtMillis ? `last ${formatRelative(agent.lastActionAtMillis)}` : 'no activity yet'} />
              <Stat label="Failed (24h)" value={agent.failedLast24h} tone={agent.failedLast24h > 0 ? 'bad' : 'default'} />
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">OpenAI</span><Badge tone={agent.openAiConfigured ? 'good' : 'warn'}>{agent.openAiConfigured ? 'configured' : 'missing key'}</Badge></div>
                  <ConnectionTest integration="openai" />
                </div>
                <div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">GA4</span><Badge tone={agent.googleAnalyticsConfigured ? 'good' : 'warn'}>{agent.googleAnalyticsConfigured ? 'configured' : 'not configured'}</Badge></div>
                  <ConnectionTest integration="google-analytics" />
                </div>
                <div className="flex items-center justify-between"><span className="text-slate-500">Timezone</span><span>{agent.timezone}</span></div>
              </div>
            </div>
          ) : <Spinner />}
        </Card>
      </div>
    </>
  );
}
