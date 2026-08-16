import type {
  CareerPath,
  CareerScoreResponse,
  PortfolioProgressEvent,
} from '@proofly/shared-types';
import { apiBaseUrl, fetchCareerScore } from './prooflyApi.js';

export interface CareerScoreStreamHandlers {
  onProgress: (event: PortfolioProgressEvent) => void;
  signal?: AbortSignal;
}

/**
 * Reads the portfolio pass as it happens. Falls back to the plain JSON endpoint when the
 * runtime cannot stream, so the score is always reachable even without progress events.
 */
export async function streamCareerScore(
  username: string,
  careerPath: CareerPath,
  { onProgress, signal }: CareerScoreStreamHandlers,
): Promise<CareerScoreResponse> {
  const url = `${apiBaseUrl}/api/github/users/${encodeURIComponent(
    username,
  )}/career-score/stream?careerPath=${careerPath}`;

  let response: Response;
  try {
    response = await fetch(url, {
      signal,
      headers: { Accept: 'text/event-stream' },
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return fetchCareerScore(username, careerPath);
  }

  if (!response.ok || !response.body) {
    if (response.status === 400) {
      const body = (await response.json()) as { error?: { message?: string } };
      throw new Error(
        body.error?.message ?? 'Unable to build a portfolio career score.',
      );
    }

    return fetchCareerScore(username, careerPath);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: CareerScoreResponse | null = null;

  while (result === null) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);

      const handled = handleFrame(frame, onProgress);
      if (handled) {
        result = handled;
        break;
      }

      separator = buffer.indexOf('\n\n');
    }
  }

  await reader.cancel().catch(() => {});

  if (result === null) {
    throw new Error('The portfolio stream ended before a score was produced.');
  }

  return result;
}

function handleFrame(
  frame: string,
  onProgress: (event: PortfolioProgressEvent) => void,
): CareerScoreResponse | null {
  let eventName = 'message';
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const payload: unknown = JSON.parse(dataLines.join('\n'));

  if (eventName === 'result') {
    return payload as CareerScoreResponse;
  }

  if (eventName === 'failure') {
    const failure = payload as { error?: { message?: string } };
    throw new Error(
      failure.error?.message ??
        'Proofly could not build a portfolio career score.',
    );
  }

  if (eventName === 'progress') {
    onProgress(payload as PortfolioProgressEvent);
  }

  return null;
}
