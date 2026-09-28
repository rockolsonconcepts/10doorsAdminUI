import { FormEvent, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Table, inputClass } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { ScreeningEmailDomainRule, ScreeningEmailDomainRuleType } from '@/model/admin';

function DomainList({ domains, tone }: { domains: string[]; tone: 'good' | 'bad' }) {
  if (!domains.length) return <Empty>None</Empty>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {domains.map((d) => <Badge key={d} tone={tone}>{d}</Badge>)}
    </div>
  );
}

export function ScreeningDomainsScreen() {
  const clients = useAsync(() => backendApi.clients(), []);
  const [clientId, setClientId] = useState('');
  const policy = useAsync(
    () => (clientId ? backendApi.screeningDomainPolicy(clientId) : Promise.resolve(null)),
    [clientId],
  );
  const [domain, setDomain] = useState('');
  const [ruleType, setRuleType] = useState<ScreeningEmailDomainRuleType>('ALLOW');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (clientId || !clients.data?.length) return;
    setClientId((clients.data.find((c) => c.isDefault === true) ?? clients.data[0]).clientId);
  }, [clients.data, clientId]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      policy.reload();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    if (await run(() => backendApi.upsertScreeningDomainRule(clientId, domain.trim(), ruleType))) setDomain('');
  }

  function onRemove(rule: ScreeningEmailDomainRule) {
    const allowRules = policy.data?.rules.filter((r) => r.ruleType === 'ALLOW') ?? [];
    const lastAllow = rule.ruleType === 'ALLOW' && allowRules.length === 1;
    const message = lastAllow
      ? `${rule.emailDomain} is this client's last allowed domain. Removing it makes the client fall back to the default allowed domains from the backend properties. Continue?`
      : `Remove the ${rule.ruleType.toLowerCase()} rule for ${rule.emailDomain}?`;
    if (!window.confirm(message)) return;
    void run(() => backendApi.deleteScreeningDomainRule(rule.ruleId));
  }

  const data = policy.data;
  const clientName = (id: string) => {
    const c = clients.data?.find((x) => x.clientId === id);
    return c && typeof c.clientName === 'string' ? c.clientName : id;
  };

  return (
    <>
      <PageHeader
        title="Screening Email Domains"
        subtitle="Which manager email domains may use applicant screening, per client. Blocked domains always win."
      />
      <div className="space-y-6">
        <Card title="Client">
          <ErrorNote message={clients.error} />
          {clients.loading ? <Spinner /> : !clients.data?.length ? <Empty>No clients.</Empty> : (
            <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.data.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {clientName(c.clientId)} ({c.clientId})
                </option>
              ))}
            </select>
          )}
        </Card>

        <ErrorNote message={policy.error} />
        {clientId && policy.loading && !data ? <Spinner /> : data && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card
                title="Allowed domains in effect"
                actions={data.allowedDomainsSource === 'CLIENT_RULES'
                  ? <Badge tone="info">client rules</Badge>
                  : <Badge tone="warn">properties defaults</Badge>}
              >
                {data.allowedDomainsSource === 'DEFAULTS' && (
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                    This client has no allow rules, so the backend's <code>screening.domains.default-allowed</code> list applies.
                    Adding an allow rule replaces that list for this client.
                  </p>
                )}
                <DomainList domains={data.effectiveAllowedDomains} tone="good" />
              </Card>
              <Card title="Blocked domains in effect">
                <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                  <code>screening.domains.default-blocked</code> plus this client's block rules.
                </p>
                <DomainList domains={data.effectiveBlockedDomains} tone="bad" />
              </Card>
            </div>

            <Card title="Rules">
              <form className="mb-4 flex flex-wrap gap-2" onSubmit={onAdd}>
                <input
                  className={`${inputClass} max-w-xs`}
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
                <select
                  className={`${inputClass} w-32`}
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as ScreeningEmailDomainRuleType)}
                >
                  <option value="ALLOW">Allow</option>
                  <option value="BLOCK">Block</option>
                </select>
                <Button type="submit" disabled={busy || !domain.trim()}>Save rule</Button>
              </form>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Matching is on the exact domain: <code>kw.com</code> does not cover <code>sub.kw.com</code>.
                Saving a domain that already has a rule changes its type.
              </p>
              <ErrorNote message={actionError} />
              {!data.rules.length ? <Empty>No rules for this client.</Empty> : (
                <Table head={<><th>Domain</th><th>Type</th><th>Added by</th><th>When</th><th></th></>}>
                  {data.rules.map((r) => (
                    <tr key={r.ruleId}>
                      <td className="font-mono text-xs">{r.emailDomain}</td>
                      <td><Badge tone={r.ruleType === 'ALLOW' ? 'good' : 'bad'}>{r.ruleType}</Badge></td>
                      <td className="font-mono text-xs">{r.createdBy ?? '—'}</td>
                      <td className="whitespace-nowrap">{formatDateTime(r.creationTimestamp)}</td>
                      <td className="text-right">
                        <Button variant="ghost" disabled={busy} onClick={() => onRemove(r)} title="Remove rule">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
