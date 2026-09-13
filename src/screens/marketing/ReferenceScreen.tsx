import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Table } from '@/components/ui';

export function ReferenceScreen() {
  const objectives = useAsync(() => backendApi.objectives(), []);
  const campaigns = useAsync(() => backendApi.campaigns(), []);
  const segments = useAsync(() => backendApi.segments(), []);
  const channels = useAsync(() => backendApi.channels(), []);
  const rules = useAsync(() => backendApi.rules(), []);
  const insights = useAsync(() => backendApi.insights(), []);

  async function toggleChannel(channelId: string, enabled: boolean) {
    const current = channels.data?.find((c) => c.channelId === channelId);
    if (!current) return;
    await backendApi.updateChannel(channelId, { ...current, enabled });
    channels.reload();
  }

  return (
    <>
      <PageHeader title="Reference Data" subtitle="What the agent plans against: objectives, campaigns, audiences, channels, rules and learned insights" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Objectives">
          <ErrorNote message={objectives.error} />
          {objectives.loading ? <Spinner /> : !objectives.data?.length ? <Empty>None.</Empty> : (
            <Table head={<><th>Name</th><th>Type</th><th>Progress</th><th>Status</th></>}>
              {objectives.data.map((o) => (
                <tr key={o.objectiveId}>
                  <td>{o.name}</td>
                  <td><Badge>{o.type}</Badge></td>
                  <td>{o.currentValue ?? '—'} / {o.targetValue ?? '—'}{o.baselineValue != null && <span className="text-xs text-slate-500"> (base {o.baselineValue})</span>}</td>
                  <td><Badge tone={o.status === 'ACTIVE' ? 'good' : 'default'}>{o.status}</Badge></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Campaigns">
          <ErrorNote message={campaigns.error} />
          {campaigns.loading ? <Spinner /> : !campaigns.data?.length ? <Empty>None yet — the agent creates campaigns from approved ideas.</Empty> : (
            <Table head={<><th>Name</th><th>Hypothesis</th><th>Status</th></>}>
              {campaigns.data.map((c) => (
                <tr key={c.campaignId}><td>{c.name}</td><td className="max-w-xs truncate" title={c.hypothesis ?? ''}>{c.hypothesis}</td><td><Badge>{c.campaignStatus}</Badge></td></tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Audience segments">
          <ErrorNote message={segments.error} />
          {segments.loading ? <Spinner /> : !segments.data?.length ? <Empty>None.</Empty> : (
            <Table head={<><th>Name</th><th>Description</th><th></th></>}>
              {segments.data.map((s) => (
                <tr key={s.audienceSegmentId}><td>{s.name}</td><td className="text-slate-600 dark:text-slate-300">{s.description}</td><td>{s.active ? <Badge tone="good">active</Badge> : <Badge>inactive</Badge>}</td></tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Channels">
          <ErrorNote message={channels.error} />
          {channels.loading ? <Spinner /> : !channels.data?.length ? <Empty>None.</Empty> : (
            <Table head={<><th>Name</th><th>Type</th><th>Cap/day</th><th></th></>}>
              {channels.data.map((c) => (
                <tr key={c.channelId}>
                  <td>{c.name}{c.handle && <span className="ml-1 text-xs text-slate-500">{c.handle}</span>}</td>
                  <td><Badge>{c.channelType}</Badge></td>
                  <td>{c.maxPostsPerDay}</td>
                  <td><Button variant="secondary" onClick={() => toggleChannel(c.channelId, !c.enabled)}>{c.enabled ? 'Disable' : 'Enable'}</Button></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Strategy rules">
          <ErrorNote message={rules.error} />
          {rules.loading ? <Spinner /> : !rules.data?.length ? <Empty>None.</Empty> : (
            <Table head={<><th>Rule</th><th>Type</th><th>Status</th><th></th></>}>
              {rules.data.map((r) => (
                <tr key={r.ruleId}>
                  <td>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-500">WHEN {r.condition} → {r.action}</div>
                  </td>
                  <td><Badge tone={r.ruleType === 'POLICY' || r.ruleType === 'PLATFORM' ? 'warn' : 'default'}>{r.ruleType}</Badge></td>
                  <td><Badge tone={r.ruleStatus === 'ACTIVE' ? 'good' : 'default'}>{r.ruleStatus}</Badge></td>
                  <td>
                    <Button variant="secondary" onClick={() => backendApi.setRuleStatus(r.ruleId, r.ruleStatus === 'ACTIVE' ? 'RETIRED' : 'ACTIVE').then(rules.reload)}>
                      {r.ruleStatus === 'ACTIVE' ? 'Retire' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Insights">
          <ErrorNote message={insights.error} />
          {insights.loading ? <Spinner /> : !insights.data?.length ? <Empty>None yet — the weekly learn tick proposes insights once there is enough data.</Empty> : (
            <Table head={<><th>Statement</th><th>Confidence</th><th>n</th><th></th></>}>
              {insights.data.map((i) => (
                <tr key={i.marketingInsightId}>
                  <td><Badge>{i.insightType}</Badge> {i.statement}</td>
                  <td>{i.confidence != null ? `${Math.round(Number(i.confidence) * 100)}%` : '—'}</td>
                  <td>{i.sampleSize}</td>
                  <td><Button variant="secondary" onClick={() => backendApi.setInsightActive(i.marketingInsightId, !i.active).then(insights.reload)}>{i.active ? 'Deactivate' : 'Activate'}</Button></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
