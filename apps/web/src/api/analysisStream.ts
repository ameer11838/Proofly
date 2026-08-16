import type {
  AnalysisProgressEvent,
  CareerPath,
  RepositoryAnalysisResponse,
} from '@proofly/shared-types';
import { apiBaseUrl, fetchRepositoryAnalysis } from './prooflyApi.js';

export interface AnalysisStreamHandlers {
  onProgress: (event: AnalysisProgressEvent) => void;
  signal?: AbortSignal;
}

/**
 * Reads the server-sent analysis stream. Falls back to the plain JSON endpoint when the
 * runtime cannot stream, so the report is always reachable even without progress events.
 */
export async function streamRepositoryAnalysis(
  owner: string,
  repo: string,
  careerPath: CareerPath,
  { onProgress, signal }: AnalysisStreamHandlers,
): Promise<RepositoryAnalysisResponse> {
  const url = `${apiBaseUrl}/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo,
  )}/analysis/stream?careerPath=${careerPath}`;

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
    return fetchRepositoryAnalysis(owner, repo, careerPath);
  }

  if (!response.ok || !response.body) {
    // A validation error still returns JSON, so surface it rather than silently retrying.
    if (response.status === 400) {
      const body = (await response.json()) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? 'Unable to analyze repository.');
    }

    return fetchRepositoryAnalysis(owner, repo, careerPath);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: RepositoryAnalysisResponse | null = null;

  while (result === null) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
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
    throw new Error('The analysis stream ended before a report was produced.');
  }

  return result;
}

/** Returns the final report when the frame carries it, otherwise reports progress. */
function handleFrame(
  frame: string,
  onProgress: (event: AnalysisProgressEvent) => void,
): RepositoryAnalysisResponse | null {
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
    return payload as RepositoryAnalysisResponse;
  }

  if (eventName === 'failure') {
    const failure = payload as { error?: { message?: string } };
    throw new Error(
      failure.error?.message ?? 'Proofly could not analyze this repository.',
    );
  }

  if (eventName === 'progress') {
    onProgress(payload as AnalysisProgressEvent);
  }

  return null;
}
