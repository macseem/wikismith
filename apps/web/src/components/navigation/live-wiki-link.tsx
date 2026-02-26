import type { ComponentProps } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LIVE_WIKI_LABEL, LIVE_WIKI_URL } from '@/lib/constants/live-wiki';

interface LiveWikiLinkProps {
  buttonVariant?: ComponentProps<typeof Button>['variant'];
  buttonSize?: ComponentProps<typeof Button>['size'];
  className?: string;
}

export const LiveWikiLink = ({
  buttonVariant = 'outline',
  buttonSize = 'sm',
  className,
}: LiveWikiLinkProps) => (
  <Button asChild size={buttonSize} variant={buttonVariant} className={className}>
    <a
      href={LIVE_WIKI_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${LIVE_WIKI_LABEL} (opens in a new tab)`}
    >
      <span>{LIVE_WIKI_LABEL}</span>
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  </Button>
);
