import { describe, expect, it } from 'vitest';
import { LIVE_WIKI_LABEL, LIVE_WIKI_URL } from '@/lib/constants/live-wiki';

describe('live wiki constants', () => {
  it('exports the expected label and destination URL', () => {
    expect(LIVE_WIKI_LABEL).toBe('Live Wiki');
    expect(LIVE_WIKI_URL).toBe(
      'https://wikismith.dudkin-garage.com/s/776e7126-1ef9-43a2-bf4b-1ee087851042',
    );
  });
});
