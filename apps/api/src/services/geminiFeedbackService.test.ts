import type {
  AnalysisProgressEvent,
  RepositoryAnalysisResponse,
} from '@proofly/shared-types';
import { describe, expect, it, vi } from 'vitest';
import {
  addGeminiFeedback,
  generateGeminiFeedback,
  type GeminiTextGenerator,
} from './geminiFeedbackService.js';

const analysis = {
  repository: {
    name: 'proofly',
    description: 'Evidence-backed portfolio feedback',
    language: 'TypeScript',
  },
  careerPath: 'software-engineering',
  rating: {
    score: 7.4,
    label: 'Strong',
    summary: 'Proofly demonstrates a substantial TypeScript application.',
    reasoning: [],
  },
  breakdown: {
    score: 7.4,
    maxScore: 10,
    categories: [
      {
        key: 'technical-skills',
        label: 'Technical skills',
        description: 'Implementation breadth and depth.',
        earned: 2.2,
        max: 3,
        signals: [
          {
            label: 'TypeScript implementation',
            earned: 2.2,
            max: 3,
            detail: 'Substantial TypeScript source was found.',
            evidence: [
              { kind: 'file', label: 'TypeScript', path: 'src/App.tsx' },
            ],
          },
        ],
      },
      {
        key: 'career-relevance',
        label: 'Career relevance',
        description: 'Evidence for the selected career.',
        earned: 2,
        max: 2.5,
        signals: [
          {
            label: 'Frontend engineering evidence',
            earned: 2,
            max: 2.5,
            detail: 'React application code matches the career rubric.',
            evidence: [
              { kind: 'file', label: 'React', path: 'src/App.tsx' },
            ],
          },
        ],
      },
      {
        key: 'creativity-complexity',
        label: 'Creativity & complexity',
        description: 'Originality and implementation complexity.',
        earned: 1.4,
        max: 2,
        signals: [
          {
            label: 'Application workflow',
            earned: 1.4,
            max: 2,
            detail: 'The application coordinates a multi-stage workflow.',
            evidence: [
              { kind: 'file', label: 'Workflow', path: 'src/App.tsx' },
            ],
          },
        ],
      },
      {
        key: 'project-quality',
        label: 'Project quality',
        description: 'Testing and engineering practices.',
        earned: 1,
        max: 1.5,
        signals: [
          {
            label: 'Automated testing',
            earned: 1,
            max: 1.5,
            detail: 'Unit tests were found.',
            evidence: [
              { kind: 'file', label: 'Tests', path: 'src/app.test.ts' },
            ],
          },
        ],
      },
      {
        key: 'presentation',
        label: 'Presentation',
        description: 'Documentation and project framing.',
        earned: 0.8,
        max: 1,
        signals: [
          {
            label: 'README documentation',
            earned: 0.8,
            max: 1,
            detail: 'The README explains the project.',
            evidence: [
              { kind: 'file', label: 'README', path: 'README.md' },
            ],
          },
        ],
      },
    ],
  },
  engineering: { score: 76 },
  careerRelevance: { score: 81 },
  codeEvidence: [
    {
      id: 'react-hook',
      detected: 'React state management',
      why: 'The component coordinates asynchronous UI state.',
      fragment: 'const [state, setState] = useState(null);',
      path: 'src/App.tsx',
      startLine: 12,
    },
  ],
  codeQuality: {
    findings: [],
  },
  developmentActivity: { summary: '12 commits across 8 active days.' },
  improvementPlan: {
    actions: [
      {
        id: 'add-integration-tests',
        title: 'Add integration tests',
        detail: 'The API boundary has no integration coverage.',
        points: 0.5,
        paths: ['src/api.ts'],
      },
    ],
  },
  fileReport: { analyzedCount: 12, totalFiles: 40 },
  findings: [],
  suggestions: [],
  analyzedFiles: [],
  ignoredFilesCount: 28,
} as unknown as RepositoryAnalysisResponse;

describe('Gemini feedback service', () => {
  it('attaches grounded feedback without changing deterministic scores', async () => {
    const generateText = vi.fn<GeminiTextGenerator>(async () =>
      JSON.stringify({
        summary: 'This project shows a well-structured TypeScript application.',
        careerNarrative:
          'The supplied evidence supports software-engineering experience.',
        strengths: [
          {
            title: 'Stateful frontend architecture',
            explanation:
              'The component coordinates asynchronous state explicitly.',
            evidenceIds: ['code:react-hook'],
          },
        ],
        improvements: [
          {
            title: 'Test the API boundary',
            explanation:
              'Integration coverage would make the application more credible.',
            suggestedAction:
              'Add request-level tests for success and failure responses.',
            evidenceIds: ['action:add-integration-tests'],
          },
        ],
        categoryScores: [
          {
            category: 'technical-skills',
            score: 2.4,
            rationale: 'The implementation shows substantial TypeScript work.',
            evidenceIds: ['score:technical-skills:0'],
          },
          {
            category: 'career-relevance',
            score: 2,
            rationale: 'The React workflow supports the selected career path.',
            evidenceIds: ['score:career-relevance:0'],
          },
          {
            category: 'creativity-complexity',
            score: 1.6,
            rationale: 'The application coordinates multiple analysis stages.',
            evidenceIds: ['score:creativity-complexity:0'],
          },
          {
            category: 'project-quality',
            score: 1.2,
            rationale: 'Tests are present, though integration coverage is incomplete.',
            evidenceIds: ['score:project-quality:0'],
          },
          {
            category: 'presentation',
            score: 0.8,
            rationale: 'The README provides useful project framing.',
            evidenceIds: ['score:presentation:0'],
          },
        ],
      }),
    );

    const result = await addGeminiFeedback(analysis, { generateText });

    expect(result.breakdown.score).toBe(7.4);
    expect(result.rating.score).toBe(7.6);
    expect(result.aiFeedback?.provider).toBe('Google Gemini');
    expect(result.aiFeedback?.model).toBe('gemini-3.5-flash');
    expect(result.aiFeedback?.scoring).toMatchObject({
      deterministicScore: 7.4,
      deterministicWeight: 0.7,
      aiScore: 8,
      aiWeight: 0.3,
      finalScore: 7.6,
    });
    expect(result.aiFeedback?.strengths[0]?.evidence[0]).toMatchObject({
      path: 'src/App.tsx',
      line: 12,
    });
    expect(result.aiFeedback?.improvements[0]?.evidence[0]).toMatchObject({
      path: 'src/api.ts',
    });
    expect(generateText).toHaveBeenCalledOnce();
  });

  it('rejects invented evidence and keeps the deterministic report', async () => {
    const result = await generateGeminiFeedback(analysis, {
      generateText: async () =>
        JSON.stringify({
          summary: 'A long enough summary that would otherwise be accepted.',
          careerNarrative:
            'A long enough career narrative that would otherwise be accepted.',
          strengths: [
            {
              title: 'Invented database layer',
              explanation: 'This claim has no supplied repository evidence.',
              evidenceIds: ['made-up:file'],
            },
          ],
          improvements: [],
          categoryScores: [
            {
              category: 'technical-skills',
              score: 2.4,
              rationale: 'The implementation shows substantial TypeScript work.',
              evidenceIds: ['score:technical-skills:0'],
            },
            {
              category: 'career-relevance',
              score: 2,
              rationale: 'The React workflow supports the selected career path.',
              evidenceIds: ['score:career-relevance:0'],
            },
            {
              category: 'creativity-complexity',
              score: 1.6,
              rationale: 'The application coordinates multiple analysis stages.',
              evidenceIds: ['score:creativity-complexity:0'],
            },
            {
              category: 'project-quality',
              score: 1.2,
              rationale: 'Tests are present, but integration coverage is incomplete.',
              evidenceIds: ['score:project-quality:0'],
            },
            {
              category: 'presentation',
              score: 0.8,
              rationale: 'The README provides useful project framing.',
              evidenceIds: ['score:presentation:0'],
            },
          ],
        }),
    });

    expect(result).toBeNull();
  });

  it('reports a completed fallback stage when no API key is configured', async () => {
    const progress: AnalysisProgressEvent[] = [];

    const result = await addGeminiFeedback(analysis, {
      onProgress: (event) => progress.push(event),
    });

    expect(result).toBe(analysis);
    expect(progress).toEqual([
      expect.objectContaining({
        stage: 'generating-feedback',
        status: 'complete',
      }),
    ]);
  });
});
