import { getWorkOS } from '@workos-inc/authkit-nextjs';

interface GetGitHubSignInUrlOptions {
  returnPathname?: string;
  promptConsent?: boolean;
  state?: string;
}

const toUrlSafeBase64 = (value: string): string =>
  Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

const buildState = (returnPathname?: string, state?: string): string | undefined => {
  const internalState = returnPathname
    ? toUrlSafeBase64(JSON.stringify({ returnPathname }))
    : undefined;

  if (internalState && state) {
    return `${internalState}.${state}`;
  }

  return internalState ?? state;
};

export const getGitHubSignInUrl = ({
  returnPathname,
  promptConsent = false,
  state,
}: GetGitHubSignInUrlOptions = {}): string => {
  const clientId = process.env['WORKOS_CLIENT_ID'];
  if (!clientId) {
    throw new Error('WORKOS_CLIENT_ID environment variable is required.');
  }

  const redirectUri =
    process.env['WORKOS_REDIRECT_URI'] ?? process.env['NEXT_PUBLIC_WORKOS_REDIRECT_URI'];
  if (!redirectUri) {
    throw new Error(
      'WORKOS_REDIRECT_URI (or NEXT_PUBLIC_WORKOS_REDIRECT_URI) environment variable is required.',
    );
  }

  return getWorkOS().userManagement.getAuthorizationUrl({
    provider: 'authkit',
    clientId,
    redirectUri,
    screenHint: 'sign-in',
    prompt: promptConsent ? 'consent' : undefined,
    state: buildState(returnPathname, state),
  });
};
