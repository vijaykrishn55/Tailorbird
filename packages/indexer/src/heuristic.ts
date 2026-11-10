import { techTerms } from '@ra/retrieval';
import type { ProjectEntry } from '@ra/schemas';
import { firstParagraph, readmeExcerpt } from './readme-text';
import type { RepoInfo } from './github-client';

/** Dependency names map to technologies even when the README never mentions them. */
const DEP_TERMS: Record<string, string> = {
  fastapi: 'FastAPI',
  flask: 'Flask',
  django: 'Django',
  express: 'Express',
  react: 'React',
  'react-dom': 'React',
  next: 'Next.js',
  vue: 'Vue',
  '@angular/core': 'Angular',
  svelte: 'Svelte',
  redux: 'Redux',
  '@reduxjs/toolkit': 'Redux',
  tailwindcss: 'Tailwind CSS',
  vite: 'Vite',
  typescript: 'TypeScript',
  mongoose: 'MongoDB',
  mongodb: 'MongoDB',
  pymongo: 'MongoDB',
  mysql: 'MySQL',
  mysql2: 'MySQL',
  pg: 'PostgreSQL',
  psycopg2: 'PostgreSQL',
  'psycopg2-binary': 'PostgreSQL',
  sqlalchemy: 'SQLAlchemy',
  redis: 'Redis',
  pydantic: 'Pydantic',
  pytest: 'pytest',
  jest: 'Jest',
  vitest: 'Vitest',
  'socket.io': 'Socket.IO',
  jsonwebtoken: 'JWT',
  pyjwt: 'JWT',
  langchain: 'LangChain',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  groq: 'Groq',
  torch: 'PyTorch',
  tensorflow: 'TensorFlow',
  'scikit-learn': 'scikit-learn',
  pandas: 'pandas',
  numpy: 'NumPy',
  qdrant_client: 'Qdrant',
  'qdrant-client': 'Qdrant',
  faiss: 'FAISS',
  'faiss-cpu': 'FAISS',
  chromadb: 'ChromaDB',
  'sentence-transformers': 'sentence-transformers',
  transformers: 'Hugging Face',
  vllm: 'vLLM',
  uvicorn: 'Uvicorn',
  aiosqlite: 'SQLite',
  httpx: 'httpx',
  requests: 'requests',
  docker: 'Docker',
  locust: 'Locust',
  playwright: 'Playwright',
  selenium: 'Selenium',
  ragas: 'RAGAS',
  peft: 'PEFT',
  mcp: 'MCP',
};

export interface RepoEvidence {
  testFiles: number;
  hasCI: boolean;
  hasDocker: boolean;
}

export function stackFor(repo: RepoInfo, readme: string, deps: string[]): string[] {
  const out: string[] = [];
  const add = (t: string) => t && !out.includes(t) && out.push(t);
  if (repo.language) add(repo.language);
  for (const d of deps) {
    const t = DEP_TERMS[d.toLowerCase()];
    if (t) add(t);
  }
  for (const t of techTerms(`${repo.description} ${repo.topics.join(' ')} ${readme}`)) add(t);
  return out.slice(0, 14);
}

/** A project entry built only from what is in the repository. Nothing is invented and no model is needed. */
export function heuristicEntry(
  repo: RepoInfo,
  readme: string,
  deps: string[],
  ev: RepoEvidence,
): ProjectEntry {
  const summary = repo.description || firstParagraph(readme) || `${repo.name} project`;
  const stack = stackFor(repo, readme, deps);
  if (ev.hasDocker && !stack.includes('Docker')) stack.push('Docker');
  if (ev.hasCI && !stack.includes('GitHub Actions')) stack.push('GitHub Actions');
  const facts: string[] = [];
  if (ev.testFiles > 0) facts.push(`${ev.testFiles} test files`);
  return {
    id: repo.name,
    url: repo.htmlUrl,
    name: repo.name,
    year: repo.pushedAt.slice(0, 4),
    summary: facts.length ? `${summary} (${facts.join(', ')})` : summary,
    readme: readmeExcerpt(readme),
    stackVerified: stack,
    metrics: [],
    bullets: [],
    doNotClaim: [],
    ratingBasis: 'built from the repository README, dependency files and file list',
    liveCheck: [],
  };
}
