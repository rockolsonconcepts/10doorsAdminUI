import { useState } from 'react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Campaign, Channel } from '@/model/marketing';
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Table, inputClass } from '@/components/ui';
import { AddCampaignForm, AddChannelForm, AddObjectiveForm, AddSegmentForm } from './ReferenceForms';

export function ReferenceScreen() {
  const objectives = useAsync(() => backendApi.objectives(), []);
  const campaigns = useAsync(() => backendApi.campaigns(), []);
  const segments = useAsync(() => backendApi.segments(), []);
  const channels = useAsync(() => backendApi.channels(), []);
  const rules = useAsync(() => backendApi.rules(), []);
  const insights = useAsync(() => backendApi.insights(), []);

  async function updateChannel(channelId: string, changes: Partial<Pick<Channel, 'enabled' | 'manualPosting'>>) {
    const current = channels.data?.find((c) => c.channelId === channelId);
    if (!current) return;
    await backendApi.updateChannel(channelId, { ...current, ...changes });
    channels.reload();
  }

  async function toggleSegment(segmentId: string, active: boolean) {
    const current = segments.data?.find((s) => s.audienceSegmentId === segmentId);
    if (!current) return;
    await backendApi.updateSegment(segmentId, { ...current, active });
    segments.reload();
  }

  async function setObjectiveStatus(objectiveId: string, status: string) {
    const current = objectives.data?.find((o) => o.objectiveId === objectiveId);
    if (!current) return;
    await backendApi.updateObjective(objectiveId, { ...current, status });
    objectives.reload();
  }

  return (
    <>
      <PageHeader title="Reference Data" subtitle="What the agent plans against: objectives, campaigns, audiences, channels, rules and learned insights" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Objectives">
          <ErrorNote message={objectives.error} />
          {objectives.loading ? <Spinner /> : !objectives.data?.length ? <Empty>None yet — add the outcome the agent should work toward (e.g. registrations).</Empty> : (
            <Table head={<><th>Name</th><th>Type</th><th>Progress</th><th>Status</th><th></th></>}>
              {objectives.data.map((o) => (
                <tr key={o.objectiveId}>
                  <td>{o.name}</td>
                  <td><Badge>{o.type}</Badge></td>
                  <td>{o.currentValue ?? '—'} / {o.targetValue ?? '—'}{o.baselineValue != null && <span className="text-xs text-slate-500"> (base {o.baselineValue})</span>}</td>
                  <td><Badge tone={o.status === 'ACTIVE' ? 'good' : 'default'}>{o.status}</Badge></td>
                  <td><Button variant="secondary" onClick={() => setObjectiveStatus(o.objectiveId, o.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE')}>{o.status === 'ACTIVE' ? 'Pause' : 'Activate'}</Button></td>
                </tr>
              ))}
            </Table>
          )}
          <AddObjectiveForm onCreated={objectives.reload} />
        </Card>
        <Card title="Campaigns">
          <ErrorNote message={campaigns.error} />
          {campaigns.loading ? <Spinner /> : !campaigns.data?.length ? <Empty>None yet — add one so the planner has something to file ideas under.</Empty> : (
            <Table head={<><th>Name</th><th>Hypothesis</th><th>Status</th><th></th></>}>
              {campaigns.data.map((c) => (
                <tr key={c.campaignId}>
                  <td>{c.name}</td>
                  <td className="max-w-xs truncate" title={c.hypothesis ?? ''}>{c.hypothesis}</td>
                  <td><Badge tone={c.campaignStatus === 'ACTIVE' ? 'good' : 'default'}>{c.campaignStatus}</Badge></td>
                  <td><Button variant="secondary" onClick={() => backendApi.setCampaignStatus(c.campaignId, c.campaignStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE').then(campaigns.reload)}>{c.campaignStatus === 'ACTIVE' ? 'Pause' : 'Activate'}</Button></td>
                </tr>
              ))}
            </Table>
          )}
          {!objectives.loading && !segments.loading && !channels.loading && (
            <AddCampaignForm objectives={objectives.data ?? []} segments={segments.data ?? []} channels={channels.data ?? []} onCreated={campaigns.reload} />
          )}
        </Card>
        <Card title="Audience segments">
          <ErrorNote message={segments.error} />
          {segments.loading ? <Spinner /> : !segments.data?.length ? <Empty>None yet — describe who the content is for, with their real pain points.</Empty> : (
            <Table head={<><th>Name</th><th>Description</th><th></th><th></th></>}>
              {segments.data.map((s) => (
                <tr key={s.audienceSegmentId}>
                  <td>{s.name}</td>
                  <td className="text-slate-600 dark:text-slate-300">{s.description}</td>
                  <td>{s.active ? <Badge tone="good">active</Badge> : <Badge>inactive</Badge>}</td>
                  <td><Button variant="secondary" onClick={() => toggleSegment(s.audienceSegmentId, !s.active)}>{s.active ? 'Deactivate' : 'Activate'}</Button></td>
                </tr>
              ))}
            </Table>
          )}
          <AddSegmentForm onCreated={segments.reload} />
        </Card>
        <Card title="Channels">
          <ErrorNote message={channels.error} />
          {channels.loading ? <Spinner /> : !channels.data?.length ? <Empty>None yet — add where you post (Threads, Instagram, Reddit…).</Empty> : (
            <Table head={<><th>Name</th><th>Type</th><th>Posting</th><th>Cap/day</th><th></th></>}>
              {channels.data.map((c) => (
                <tr key={c.channelId}>
                  <td>{c.name}{c.handle && <span className="ml-1 text-xs text-slate-500">{c.handle}</span>}</td>
                  <td><Badge>{c.channelType}</Badge></td>
                  <td>
                    <label className="inline-flex items-center gap-1 text-sm" title="Checked: you post by hand and record the URL (caps advisory). Unchecked: the agent posts via the channel adapter after approval.">
                      <input type="checkbox" checked={c.manualPosting} onChange={(e) => updateChannel(c.channelId, { manualPosting: e.target.checked })} />
                      Manual
                    </label>
                  </td>
                  <td>{c.maxPostsPerDay}</td>
                  <td><Button variant="secondary" onClick={() => updateChannel(c.channelId, { enabled: !c.enabled })}>{c.enabled ? 'Disable' : 'Enable'}</Button></td>
                </tr>
              ))}
            </Table>
          )}
          <AddChannelForm onCreated={channels.reload} />
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
        <Card title="Tracked links (campaign / bio)">
          {campaigns.loading ? <Spinner /> : !campaigns.data?.length ? <Empty>Create a campaign first.</Empty> : <CampaignLinks campaigns={campaigns.data} />}
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

function CampaignLinks({ campaigns }: { campaigns: Campaign[] }) {
  const [campaignId, setCampaignId] = useState(campaigns[0].campaignId);
  const [vanity, setVanity] = useState('');
  const [destination, setDestination] = useState('https://10doors.io');
  const [source, setSource] = useState('instagram');
  const [error, setError] = useState<string | null>(null);
  const links = useAsync(() => backendApi.campaignLinks(campaignId), [campaignId]);

  async function create() {
    setError(null);
    try {
      await backendApi.createAttributionLink({
        campaignId,
        scope: 'CAMPAIGN',
        vanityPath: vanity || null,
        destinationUrl: destination,
        utmSource: source,
        utmMedium: 'bio',
        utmCampaign: campaigns.find((c) => c.campaignId === campaignId)?.name ?? campaignId,
      });
      setVanity('');
      links.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-slate-500">Reusable links for placements that cannot hold a per-post link (Instagram bio, link-in-bio, spoken or typed vanity URL). Per-post links are minted automatically when a publication is created.</p>
      <select className={inputClass} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
        {campaigns.map((c) => <option key={c.campaignId} value={c.campaignId}>{c.name}</option>)}
      </select>
      <ErrorNote message={links.error} />
      {links.loading ? <Spinner /> : !links.data?.length ? <Empty>No links for this campaign.</Empty> : (
        <Table head={<><th>Tracked URL</th><th>Scope</th><th>Clicks</th></>}>
          {links.data.map((l) => (
            <tr key={l.attributionLinkId}>
              <td className="font-mono text-xs"><a className="text-blue-600 hover:underline" href={l.trackedUrl} target="_blank" rel="noreferrer">{l.trackedUrl}</a></td>
              <td><Badge tone={l.scope === 'CAMPAIGN' ? 'warn' : 'default'}>{l.scope ?? '—'}</Badge></td>
              <td>{l.clickCount}</td>
            </tr>
          ))}
        </Table>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputClass} placeholder="Vanity path, e.g. latefees" value={vanity} onChange={(e) => setVanity(e.target.value)} />
        <input className={inputClass} placeholder="utm_source" value={source} onChange={(e) => setSource(e.target.value)} />
        <input className={inputClass} placeholder="Destination URL" value={destination} onChange={(e) => setDestination(e.target.value)} />
      </div>
      <ErrorNote message={error} />
      <Button onClick={create} disabled={!destination}>Create campaign link</Button>
    </div>
  );
}
