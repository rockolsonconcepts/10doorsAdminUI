import { useState } from 'react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Badge, Button, Card, Code, Empty, ErrorNote, PageHeader, Spinner, Table, inputClass } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

export function PlatformScreen() {
  const admins = useAsync(() => backendApi.administrators(), []);
  const clients = useAsync(() => backendApi.clients(), []);
  const [userId, setUserId] = useState('');
  const [lookup, setLookup] = useState('');
  const entitlements = useAsync(() => (lookup ? backendApi.entitlements(lookup) : Promise.resolve(null)), [lookup]);

  return (
    <>
      <PageHeader title="Clients & Administrators" subtitle="Platform-level identities and entitlements" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Administrators">
          <ErrorNote message={admins.error} />
          {admins.loading ? <Spinner /> : !admins.data?.length ? <Empty>No administrators.</Empty> : (
            <Table head={<><th>Email</th><th>Created</th><th></th></>}>
              {admins.data.map((a) => (
                <tr key={a.administratorId}>
                  <td>
                    <div>{a.email}</div>
                    <button className="font-mono text-xs text-blue-600 hover:underline" onClick={() => { setUserId(a.administratorId); setLookup(a.administratorId); }}>{a.administratorId}</button>
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                  <td>{a.default && <Badge tone="info">default</Badge>}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Entitlements lookup">
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setLookup(userId.trim()); }}
          >
            <input className={inputClass} placeholder="User / subject ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
            <Button type="submit">Lookup</Button>
          </form>
          <ErrorNote message={entitlements.error} />
          {entitlements.loading ? <Spinner /> : entitlements.data === null ? <Empty>Enter a subject ID to list its entitlements.</Empty> : entitlements.data.length === 0 ? <Empty>No entitlements.</Empty> : (
            <Table head={<><th>Role</th><th>Resource</th><th>Client</th></>}>
              {entitlements.data.map((e) => (
                <tr key={e.entitlementId}>
                  <td><Badge tone={e.role === 'SYSTEM_ADMIN' ? 'warn' : 'default'}>{e.role}</Badge></td>
                  <td className="font-mono text-xs">{e.resourceType} / {e.resourceId}</td>
                  <td className="font-mono text-xs">{e.clientId}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="Clients" className="lg:col-span-2">
          <ErrorNote message={clients.error} />
          {clients.loading ? <Spinner /> : !clients.data?.length ? <Empty>No clients.</Empty> : (
            <div className="space-y-4">
              {clients.data.map((c) => (
                <details key={c.clientId} className="rounded-lg border border-slate-200 dark:border-white/10">
                  <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
                    {typeof c.clientName === 'string' ? c.clientName : c.clientId} <span className="ml-2 font-mono text-xs text-slate-500">{c.clientId}</span>
                    {c.isDefault === true && <Badge tone="info">default</Badge>}
                  </summary>
                  <div className="p-3">
                    <Code>{JSON.stringify(c, null, 2)}</Code>
                  </div>
                </details>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
