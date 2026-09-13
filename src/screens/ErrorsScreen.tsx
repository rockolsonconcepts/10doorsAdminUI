import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { Badge, Button, Card, Code, Empty, ErrorNote, PageHeader, Spinner, Table, inputClass } from '@/components/ui';
import { formatDateTime, formatRelative, prettyJson } from '@/lib/format';

const WINDOWS: { label: string; millis: number | null }[] = [
  { label: 'Last hour', millis: 3_600_000 },
  { label: 'Last 24h', millis: 86_400_000 },
  { label: 'Last 7 days', millis: 7 * 86_400_000 },
  { label: 'All', millis: null },
];

export function ErrorsScreen() {
  const [windowIdx, setWindowIdx] = useState(1);
  const [errorCode, setErrorCode] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const since = WINDOWS[windowIdx].millis === null ? undefined : Date.now() - (WINDOWS[windowIdx].millis as number);
  const list = useAsync(
    () => backendApi.tracedErrors({ since, errorCode: errorCode || undefined, page, size: 50 }),
    [windowIdx, errorCode, page],
  );
  const detail = useAsync(() => (selected ? backendApi.tracedError(selected) : Promise.resolve(null)), [selected]);

  return (
    <>
      <PageHeader
        title="Traced Errors"
        subtitle="Every exception the backend handled, with the tracedErrorId that was returned to the caller"
        actions={
          <Button variant="secondary" onClick={list.reload}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {WINDOWS.map((w, i) => (
          <Button key={w.label} variant={i === windowIdx ? 'primary' : 'secondary'} onClick={() => { setWindowIdx(i); setPage(0); }}>
            {w.label}
          </Button>
        ))}
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Filter by errorCode (e.g. NOT_FOUND)"
          value={errorCode}
          onChange={(e) => { setErrorCode(e.target.value.trim().toUpperCase()); setPage(0); }}
        />
      </div>
      <ErrorNote message={list.error} />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card title={list.data ? `${list.data.totalItems} errors` : 'Errors'}>
          {list.loading && !list.data ? (
            <Spinner />
          ) : !list.data || list.data.items.length === 0 ? (
            <Empty>No traced errors in this window.</Empty>
          ) : (
            <>
              <Table head={<><th>When</th><th>Code</th><th>Path</th><th>Description</th></>}>
                {list.data.items.map((e) => (
                  <tr
                    key={e.tracedErrorId}
                    onClick={() => setSelected(e.tracedErrorId)}
                    className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${selected === e.tracedErrorId ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                  >
                    <td className="whitespace-nowrap" title={formatDateTime(e.timestampMillis)}>{formatRelative(e.timestampMillis)}</td>
                    <td><Badge tone={toneFor(e.errorCode)}>{e.errorCode ?? '—'}</Badge></td>
                    <td className="max-w-[16rem] truncate font-mono text-xs" title={e.path ?? ''}>{e.path}</td>
                    <td className="max-w-[20rem] truncate" title={e.errorDescription ?? ''}>{e.errorDescription}</td>
                  </tr>
                ))}
              </Table>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
                <span>Page {list.data.page + 1} of {Math.max(1, list.data.totalPages)}</span>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="secondary" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card title="Detail">
          {!selected ? (
            <Empty>Select an error to see the stack trace and captured request.</Empty>
          ) : detail.loading ? (
            <Spinner />
          ) : detail.error ? (
            <ErrorNote message={detail.error} />
          ) : detail.data ? (
            <div className="space-y-4 text-sm">
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
                <dt className="text-slate-500">Trace ID</dt><dd className="font-mono text-xs">{detail.data.tracedErrorId}</dd>
                <dt className="text-slate-500">Timestamp</dt><dd>{detail.data.timestamp}</dd>
                <dt className="text-slate-500">Code</dt><dd>{detail.data.errorCode}</dd>
                <dt className="text-slate-500">Path</dt><dd className="font-mono text-xs">{detail.data.path}</dd>
                <dt className="text-slate-500">Subject</dt><dd className="font-mono text-xs">{detail.data.subjectId} {detail.data.subjectEntityType && <Badge>{detail.data.subjectEntityType}</Badge>}</dd>
                <dt className="text-slate-500">Description</dt><dd>{detail.data.errorDescription}</dd>
              </dl>
              {detail.data.inputPayload && (
                <div>
                  <div className="mb-1 font-medium">Input payload</div>
                  <Code>{prettyJson(detail.data.inputPayload)}</Code>
                </div>
              )}
              <div>
                <div className="mb-1 font-medium">Stack trace</div>
                <Code>{detail.data.exceptionTrace ?? '(none captured)'}</Code>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}

function toneFor(code: string | null): 'default' | 'warn' | 'bad' | 'info' {
  if (!code) return 'default';
  if (code.includes('NOT_FOUND') || code.includes('BAD_INPUT') || code.includes('VALIDATION')) return 'info';
  if (code.includes('AUTH')) return 'warn';
  return 'bad';
}
