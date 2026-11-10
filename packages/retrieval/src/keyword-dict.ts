/** Known technologies and concepts with their aliases. The first alias is the canonical display form. */
export interface DictEntry {
  term: string;
  aliases?: string[];
  /** Match case-sensitively (needed for very short or ambiguous words like Go, R, C). */
  caseSensitive?: boolean;
}

const E = (term: string, aliases: string[] = [], caseSensitive = false): DictEntry => ({
  term,
  aliases,
  caseSensitive,
});

export const DICTIONARY: DictEntry[] = [
  // languages
  E('Python', ['python3', 'py']),
  E('JavaScript', ['js', 'ecmascript', 'es6']),
  E('TypeScript', ['ts']),
  E('Java'),
  E('C++', ['cpp']),
  E('C#', ['csharp']),
  E('C', [], true),
  E('Go', ['golang'], true),
  E('Rust'),
  E('SQL'),
  E('Kotlin'),
  E('Swift'),
  E('PHP'),
  E('Ruby'),
  E('Scala'),
  E('R', [], true),
  E('Bash', ['shell scripting']),
  E('HTML'),
  E('CSS'),
  // web frontend
  E('React', ['React.js', 'ReactJS'], true),
  E('Next.js', ['nextjs', 'next js']),
  E('Vue', ['vue.js', 'vuejs']),
  E('Angular'),
  E('Svelte'),
  E('Redux', ['redux toolkit']),
  E('Context API'),
  E('Tailwind CSS', ['tailwind', 'tailwindcss']),
  E('Vite'),
  E('Webpack'),
  E('Material UI', ['mui']),
  E('Ant Design', ['antd']),
  E('shadcn/ui', ['shadcn']),
  E('Chart.js'),
  E('Three.js', ['threejs']),
  E('TensorFlow.js', ['tfjs']),
  // backend
  E('Node.js', ['node', 'nodejs', 'node js']),
  E('Express', ['express.js', 'expressjs']),
  E('FastAPI'),
  E('Django'),
  E('Flask'),
  E('Spring Boot', ['spring']),
  E('NestJS', ['nest.js']),
  E('REST API', ['rest apis', 'restful', 'rest', 'restful apis']),
  E('GraphQL'),
  E('gRPC'),
  E('WebSocket', ['websockets']),
  E('Socket.IO', ['socketio']),
  E('JWT', ['json web token', 'json web tokens']),
  E('OAuth', ['oauth2']),
  E('Microservices', ['microservice']),
  E('Pydantic'),
  E('asyncio'),
  E('Celery'),
  // data stores
  E('PostgreSQL', ['postgres', 'psql']),
  E('MySQL'),
  E('MongoDB', ['mongo', 'mongoose']),
  E('SQLite'),
  E('Redis'),
  E('Firebase', ['firestore']),
  E('Elasticsearch', ['opensearch']),
  E('Kafka', ['apache kafka']),
  E('RabbitMQ'),
  E('DynamoDB'),
  E('Cassandra'),
  E('Snowflake'),
  E('BigQuery'),
  E('Qdrant'),
  E('ChromaDB', ['chroma']),
  E('FAISS'),
  E('Pinecone'),
  E('pgvector'),
  E('Weaviate'),
  E('Milvus'),
  // devops / cloud
  E('Docker', ['containers', 'containerization']),
  E('Kubernetes', ['k8s']),
  E('Docker Compose'),
  E('AWS', ['amazon web services']),
  E('Azure'),
  E('GCP', ['google cloud']),
  E('Terraform'),
  E('Ansible'),
  E('Jenkins'),
  E('GitHub Actions'),
  E('CI/CD', ['ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment']),
  E('Linux'),
  E('Git'),
  E('Prometheus'),
  E('Grafana'),
  E('OpenTelemetry', ['otel']),
  E('Nginx'),
  E('KEDA'),
  E('Vercel'),
  E('Serverless', ['lambda']),
  // AI / ML
  E('LLM', ['llms', 'large language model', 'large language models']),
  E('Generative AI', ['genai', 'gen ai', 'generative ai']),
  E('RAG', ['retrieval augmented generation', 'retrieval-augmented generation']),
  E('Prompt Engineering', ['prompt design']),
  E('AI Agents', ['agentic', 'agentic ai', 'ai agent', 'agents', 'multi-agent']),
  E('Function Calling', ['tool use', 'tool calling']),
  E('ReAct', [], true),
  E('MCP', ['model context protocol']),
  E('LangChain'),
  E('LlamaIndex'),
  E('OpenAI'),
  E('Anthropic'),
  E('Groq'),
  E('Hugging Face', ['huggingface', 'transformers library']),
  E('PyTorch', ['torch']),
  E('TensorFlow'),
  E('scikit-learn', ['sklearn']),
  E('pandas'),
  E('NumPy', ['numpy']),
  E('Jupyter'),
  E('Matplotlib'),
  E('Machine Learning', ['ml']),
  E('Deep Learning'),
  E('NLP', ['natural language processing']),
  E('Computer Vision'),
  E('Fine-tuning', ['finetuning', 'fine tuning']),
  E('LoRA', ['qlora', 'peft']),
  E('DPO'),
  E('Quantization', ['awq', 'gptq']),
  E('vLLM'),
  E('Inference Optimization', ['inference']),
  E('Speculative Decoding'),
  E('Embeddings', ['embedding', 'sentence-transformers', 'sentence transformers']),
  E('Vector Database', ['vector db', 'vector databases', 'vector store', 'vector search']),
  E('Semantic Search'),
  E('Hybrid Search'),
  E('BM25'),
  E('Reranking', ['cross-encoder', 're-ranking']),
  E('RAGAS'),
  E('LLM Evaluation', ['llm evals', 'evals', 'evaluation']),
  E('Guardrails'),
  E('Prompt Injection'),
  E('Whisper'),
  E('Speech-to-Text', ['asr']),
  E('Data Science'),
  E('Data Analysis', ['data analytics']),
  E('Feature Engineering'),
  E('Time Series'),
  E('Kalman Filter'),
  E('Transformers', ['transformer']),
  E('Ollama'),
  // practices
  E('Unit Testing', ['unit tests', 'pytest', 'jest', 'vitest']),
  E('Test Automation', ['automation testing', 'automated testing', 'test automation']),
  E('Selenium'),
  E('Playwright'),
  E('Cypress'),
  E('Postman'),
  E('TDD'),
  E('Agile', ['scrum']),
  E('Data Structures', ['dsa', 'data structures and algorithms', 'algorithms']),
  E('System Design'),
  E('Object-Oriented Programming', ['oop', 'object oriented']),
  E('Design Patterns'),
  E('Caching', ['cache']),
  E('Rate Limiting', ['rate limit', 'rate limiter']),
  E('Observability', ['monitoring', 'logging']),
  E('Load Testing', ['locust', 'k6']),
  E('Authentication', ['authn', 'login']),
  E('Security', ['secure coding']),
  E('Performance Optimization', ['performance tuning']),
  E('Real-time', ['realtime', 'real time']),
  E('Scalability', ['scalable', 'high availability']),
  E('API Design', ['api development', 'apis']),
  E('Open Source', ['open-source']),
  E('Hackathon'),
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Compiled {
  term: string;
  re: RegExp;
}

const compiled: Compiled[] = DICTIONARY.map((e) => {
  const forms = [e.term, ...(e.aliases ?? [])];
  const body = forms.map(escapeRe).join('|');
  // Boundaries that also respect symbol-heavy terms like C++ and Node.js.
  const re = new RegExp(
    `(?<![A-Za-z0-9+#])(?:${body})(?![A-Za-z0-9+#]|\\.[A-Za-z0-9])`,
    e.caseSensitive ? 'g' : 'gi',
  );
  return { term: e.term, re };
});

const byLower = new Map<string, string>();
for (const e of DICTIONARY) {
  byLower.set(e.term.toLowerCase(), e.term);
  for (const a of e.aliases ?? []) if (!e.caseSensitive) byLower.set(a.toLowerCase(), e.term);
}

/** Canonical form of a single term (or the trimmed input if unknown). */
export function canonical(term: string): string {
  const key = term.trim().toLowerCase();
  return byLower.get(key) ?? term.trim();
}

/** Count how many times each known term appears in the text. */
export function countTerms(text: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const { term, re } of compiled) {
    re.lastIndex = 0;
    const n = text.match(re)?.length ?? 0;
    if (n > 0) out.set(term, n);
  }
  return out;
}

/** Known terms found in the text. */
export function normalise(text: string): string[] {
  return [...countTerms(text).keys()];
}

/** Canonical set of the terms in a list of free-form strings (known terms are mapped, unknown kept as typed). */
export function canonicalSet(items: string[]): Set<string> {
  const out = new Set<string>();
  for (const item of items) {
    const found = normalise(item);
    if (found.length > 0) for (const f of found) out.add(f);
    else out.add(canonical(item));
  }
  return out;
}

/** Concepts and practices rather than technologies. They count for job matching but never appear in a "Stack" line. */
const SOFT = new Set([
  'Caching',
  'Rate Limiting',
  'Observability',
  'Authentication',
  'Security',
  'Performance Optimization',
  'Real-time',
  'Scalability',
  'API Design',
  'Open Source',
  'Hackathon',
  'Inference Optimization',
  'LLM Evaluation',
  'Guardrails',
  'Prompt Injection',
  'Data Analysis',
  'Machine Learning',
  'Deep Learning',
  'NLP',
  'Computer Vision',
  'Data Science',
  'Feature Engineering',
  'Time Series',
  'Agile',
  'Data Structures',
  'System Design',
  'Object-Oriented Programming',
  'Design Patterns',
  'Test Automation',
  'Unit Testing',
  'Load Testing',
  'TDD',
  'Microservices',
  'Serverless',
  'Generative AI',
  'Prompt Engineering',
  'AI Agents',
  'Function Calling',
  'Semantic Search',
  'Hybrid Search',
  'Vector Database',
  'Embeddings',
  'Reranking',
  'Fine-tuning',
  'Quantization',
  'Speculative Decoding',
]);

export const isSoftTerm = (term: string): boolean => SOFT.has(term);

/** Technologies (not concepts) found in a text, in order of first appearance count. */
export function techTerms(text: string): string[] {
  return [...countTerms(text).entries()]
    .filter(([t]) => !SOFT.has(t))
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}
