import 'dotenv/config';

export interface ApiConfig {
  port: number;
  webOrigin: string;
  githubToken?: string;
}

export function getConfig(): ApiConfig {
  return {
    port: Number(process.env.PORT ?? 4000),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    githubToken: process.env.GITHUB_TOKEN || undefined,
  };
}
