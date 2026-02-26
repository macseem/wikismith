import {
  apiContracts,
  type ApiError,
  type GenerateWikiProgressEvent,
  type GenerateWikiRequest,
  type GenerateWikiResponse,
  type StoredWikiContract,
} from '@wikismith/contracts';

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: ApiError;

  constructor(status: number, payload: ApiError) {
    super(payload.error);
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

interface GenerateWikiStreamHandlers {
  signal?: AbortSignal;
  onProgress?: (event: GenerateWikiProgressEvent) => void;
}

const parseJsonSafely = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const toApiClientError = async (
  response: Response,
  fallbackMessage: string,
): Promise<ApiClientError> => {
  const payload = await parseJsonSafely(response);
  const parsedPayload = apiContracts.common.error.safeParse(payload);

  return new ApiClientError(
    response.status,
    parsedPayload.success ? parsedPayload.data : { error: fallbackMessage },
  );
};

const getWiki = async (owner: string, repo: string): Promise<StoredWikiContract> => {
  const params = apiContracts.wiki.get.params.parse({ owner, repo });
  const response = await fetch(`/api/wiki/${params.owner}/${params.repo}`);

  if (!response.ok) {
    throw await toApiClientError(response, 'Failed to load wiki.');
  }

  const payload = await parseJsonSafely(response);
  return apiContracts.wiki.get.response.parse(payload);
};

const generateWiki = async (request: GenerateWikiRequest): Promise<GenerateWikiResponse> => {
  const body = apiContracts.generate.post.body.parse(request);
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await toApiClientError(response, 'Generation failed.');
  }

  const payload = await parseJsonSafely(response);
  return apiContracts.generate.post.response.parse(payload);
};

const generateWikiStream = async (
  request: GenerateWikiRequest,
  handlers: GenerateWikiStreamHandlers = {},
): Promise<GenerateWikiResponse> => {
  const body = apiContracts.generate.post.body.parse(request);
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: handlers.signal,
  });

  if (!response.ok) {
    throw await toApiClientError(response, 'Generation failed.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = await parseJsonSafely(response);
    return apiContracts.generate.post.response.parse(payload);
  }

  if (!response.body) {
    throw new ApiClientError(500, { error: 'Streaming not supported by the browser.' });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7);
        continue;
      }

      if (!line.startsWith('data: ')) {
        continue;
      }

      const rawPayload = line.slice(6);
      let parsedPayload: unknown;

      try {
        parsedPayload = JSON.parse(rawPayload) as unknown;
      } catch {
        continue;
      }

      if (currentEvent === 'progress') {
        const progress = apiContracts.generate.post.sse.progress.parse(parsedPayload);
        handlers.onProgress?.(progress);
        continue;
      }

      if (currentEvent === 'complete') {
        return apiContracts.generate.post.sse.complete.parse(parsedPayload);
      }

      if (currentEvent === 'error') {
        const errorPayload = apiContracts.generate.post.sse.error.parse(parsedPayload);
        throw new ApiClientError(errorPayload.statusCode ?? 500, errorPayload);
      }
    }
  }

  throw new ApiClientError(500, { error: 'Connection lost. Please try again.' });
};

export const apiClient = {
  getWiki,
  generateWiki,
  generateWikiStream,
};
