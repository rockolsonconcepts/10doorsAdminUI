import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { backendApi } from '@/integration/backendapi';
import { useAsync } from '@/hooks/useAsync';
import { AttributionLink, Channel, Publication } from '@/model/marketing';
import { Badge, Button, Spinner } from '@/components/ui';

interface Placement {
  title: string;
  steps: string[];
  /** Which link to paste: the per-post link, or a reusable campaign (bio) link. */
  uses: 'post' | 'campaign';
}

const PLACEMENTS: Record<string, Placement[]> = {
  REDDIT: [
    {
      title: 'Reddit post or comment',
      uses: 'post',
      steps: [
        'Paste the full tracked URL into the post body or CTA line. Do not paste the bare 10doors.io domain and do not paste just the code.',
        'Reddit allows links in text posts, comments and link posts — use the same URL everywhere for this post.',
        'Check the subreddit rules on self-promotion before posting.',
      ],
    },
  ],
  THREADS: [
    {
      title: 'Threads post',
      uses: 'post',
      steps: [
        'Paste the full tracked URL into the post text — Threads makes it clickable.',
        'Put the link in the first post of the thread, or as a reply if you want the opener link-free.',
      ],
    },
    {
      title: 'Threads bio',
      uses: 'campaign',
      steps: ['Use the campaign link (above) in your profile bio and say "link in bio" in the post.'],
    },
  ],
  INSTAGRAM: [
    {
      title: 'Feed post / Reel caption',
      uses: 'campaign',
      steps: [
        'Captions are NOT clickable. Do not paste a URL in the caption — it will not be tracked.',
        'Put the campaign link (above) in your profile bio (or your link-in-bio page) and write "link in bio" in the caption.',
        'Attribution is per campaign for this placement; individual feed posts are not distinguishable.',
      ],
    },
    {
      title: 'Story',
      uses: 'post',
      steps: [
        'Add a Link sticker and paste the full tracked URL for this post — Story links are clickable and tracked per post.',
        'Optionally also point viewers to the bio link.',
      ],
    },
    {
      title: 'Profile bio',
      uses: 'campaign',
      steps: [
        'Paste the campaign link (above). Keep it there for the life of the campaign; swap it when the campaign changes.',
        'If you use a link-in-bio tool, add the campaign link as a button there.',
      ],
    },
  ],
  LINKEDIN: [
    {
      title: 'LinkedIn post',
      uses: 'post',
      steps: [
        'Paste the full tracked URL in the post text or the first comment (LinkedIn de-ranks posts with links in the body; the first comment is common practice).',
      ],
    },
  ],
  X: [
    { title: 'X post', uses: 'post', steps: ['Paste the full tracked URL in the post or as the first reply.'] },
  ],
  FACEBOOK: [
    { title: 'Facebook post', uses: 'post', steps: ['Paste the full tracked URL in the post body.'] },
  ],
  TIKTOK: [
    {
      title: 'TikTok video',
      uses: 'campaign',
      steps: ['Captions are not clickable. Put the campaign link in your profile bio and say "link in bio".'],
    },
  ],
  SUBSTACK: [
    {
      title: 'Substack post / newsletter issue',
      uses: 'post',
      steps: [
        'Paste the full tracked URL wherever the post links to 10Doors (inline text link or a button) — links in Substack posts and emails are clickable and tracked per issue.',
        'Substack adds its own tracking to outbound links; the /go/ link still records the click.',
      ],
    },
    {
      title: 'Publication About page / welcome email',
      uses: 'campaign',
      steps: ['Use the campaign link (above) for evergreen spots like the About page, welcome email and footer.'],
    },
  ],
  YOUTUBE: [
    { title: 'YouTube description', uses: 'post', steps: ['Paste the full tracked URL in the video description and pin it as a comment.'] },
  ],
};

const FALLBACK: Placement[] = [
  {
    title: 'Anywhere a link is allowed',
    uses: 'post',
    steps: [
      'Paste the full tracked URL wherever the platform accepts a clickable link.',
      'If links are not allowed in the post, use the campaign link in your profile bio and say "link in bio".',
    ],
  },
];

export function TrackedLinkGuide({ publication, channel }: { publication: Publication; channel: Channel | null }) {
  const postLink = useAsync(
    () => (publication.attributionLinkId ? backendApi.attributionLink(publication.attributionLinkId) : Promise.resolve(null)),
    [publication.attributionLinkId],
  );
  const campaignLinks = useAsync(
    () => (publication.campaignId ? backendApi.campaignLinks(publication.campaignId) : Promise.resolve([] as AttributionLink[])),
    [publication.campaignId],
  );

  const channelType = channel?.channelType ?? '';
  const placements = PLACEMENTS[channelType] ?? FALLBACK;
  const campaignLink = campaignLinks.data?.find((l) => l.scope === 'CAMPAIGN' && l.active) ?? null;

  if (postLink.loading || campaignLinks.loading) return <Spinner label="Loading tracked link…" />;

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-500/30 dark:bg-blue-500/5">
      <div className="flex items-center justify-between">
        <div className="font-medium">How to use the tracked link{channel ? ` on ${channel.name}` : ''}</div>
        {channelType && <Badge tone="info">{channelType}</Badge>}
      </div>

      <LinkRow label="This post's link" link={postLink.data ?? null} missing="No per-post link was minted for this publication." />
      <LinkRow
        label="Campaign (bio) link"
        link={campaignLink}
        missing="No campaign-scoped link yet — create one under Reference Data › Tracked links with a vanity path (e.g. latefees)."
      />

      <div className="space-y-2">
        {placements.map((p) => (
          <div key={p.title} className="rounded-md bg-white/70 p-2 dark:bg-white/5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {p.title}
              <Badge tone={p.uses === 'post' ? 'good' : 'warn'}>{p.uses === 'post' ? "use this post's link" : 'use campaign link'}</Badge>
            </div>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-slate-700 dark:text-slate-200">
              {p.steps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        The URL already carries the code — visitors are redirected to the landing page with <code>?ref=…</code> and UTM parameters, and
        registrations plus paid subscriptions are attributed back to this post/campaign. Never type the code into the post by itself.
      </p>
    </div>
  );
}

function LinkRow({ label, link, missing }: { label: string; link: AttributionLink | null; missing: string }) {
  const [copied, setCopied] = useState(false);
  if (!link) return <div className="text-xs text-slate-500"><span className="font-medium text-slate-600 dark:text-slate-300">{label}:</span> {missing}</div>;
  const copy = async () => {
    await navigator.clipboard.writeText(link.trackedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
        {label}
        {link.vanityPath && <span className="ml-1 text-slate-400">· vanity /{link.vanityPath}</span>}
        <span className="ml-1 text-slate-400">· {link.clickCount} clicks</span>
      </div>
      <div className="mt-0.5 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs dark:bg-black/30" title={link.trackedUrl}>{link.trackedUrl}</code>
        <Button variant="secondary" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}</Button>
      </div>
    </div>
  );
}
