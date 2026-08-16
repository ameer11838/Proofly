import type { CareerPath } from '@proofly/shared-types';

/**
 * A pattern matched against a single line of a downloaded file. When it matches,
 * Proofly can quote the surrounding lines as verbatim evidence.
 */
export interface CodeSignal {
  pattern: RegExp;
  /** Restricts the signal to matching (lowercase) file paths. */
  files?: RegExp;
  /** What Proofly detected, phrased for a reader who has not seen the code. */
  detected: string;
  /** Why the detection is meaningful for the selected career. */
  why: string;
}

/**
 * A concrete, checkable technical skill. Every field is an observable signal:
 * repository language, GitHub topic, declared dependency, file path, or source line.
 */
export interface CareerSkill {
  id: string;
  label: string;
  description: string;
  /** Relative importance inside the career. Career relevance is a weighted average. */
  weight: number;
  languages?: string[];
  topics?: string[];
  /** Dependency names as they appear in package manifests. */
  dependencies?: string[];
  pathPatterns?: RegExp[];
  codeSignals?: CodeSignal[];
}

export interface CareerSkillMap {
  summary: string;
  skills: CareerSkill[];
}

const httpClientSignals: CodeSignal[] = [
  {
    pattern: /(?:await\s+)?fetch\s*\(\s*[`'"]?(?:https?:|\/api|\$\{)/,
    files: /\.(ts|tsx|js|jsx|mjs|cjs|svelte|vue)$/,
    detected: 'Outbound HTTP request using the fetch API',
    why: 'Shows the project integrates with a real service rather than static fixtures.',
  },
  {
    pattern:
      /\b(?:axios|requests|httpx|http)\s*\.\s*(?:get|post|put|patch|delete)\s*\(/,
    detected: 'HTTP client call to an external API',
    why: 'Demonstrates working with third-party APIs, including request and response handling.',
  },
  {
    pattern: /\bnew\s+(?:HttpClient|WebClient|OkHttpClient)\s*\(/,
    detected: 'HTTP client construction',
    why: 'Shows deliberate API client setup rather than ad-hoc calls.',
  },
];

const httpServerSignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:app|router|api)\s*\.\s*(?:get|post|put|patch|delete)\s*\(\s*[`'"]/,
    detected: 'HTTP route handler definition',
    why: 'Direct evidence of designing and serving an API surface.',
  },
  {
    pattern:
      /@(?:app|router)\.(?:get|post|put|patch|delete)\s*\(|@(?:Get|Post|Put|Patch|Delete)Mapping/,
    detected: 'Declarative route binding',
    why: 'Shows framework-level API design with explicit method and path contracts.',
  },
  {
    pattern:
      /\bres(?:ponse)?\s*\.\s*status\s*\(\s*\d{3}\s*\)|\bHTTPException\s*\(|\bResponseEntity\s*\./,
    detected: 'Explicit HTTP status handling',
    why: 'Correct status codes are a signal of deliberate API contract design.',
  },
];

const sqlSignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[\s\S]*\b(?:FROM|SET|VALUES|WHERE)\b/i,
    files: /\.(sql|py|ts|js|go|java|rb|rs)$/,
    detected: 'SQL query',
    why: 'Shows first-hand relational data access rather than only ORM abstractions.',
  },
  {
    pattern: /\bCREATE\s+(?:TABLE|INDEX|MATERIALIZED\s+VIEW)\b/i,
    detected: 'Schema definition in SQL',
    why: 'Designing schemas and indexes is stronger evidence than querying an existing database.',
  },
  {
    // Restricted to .sql files: in application code `.join(` and `groupby` are ordinary
    // language methods, not SQL.
    pattern:
      /\b(?:JOIN|GROUP\s+BY|WINDOW|PARTITION\s+BY|WITH\s+\w+\s+AS\s*\()/i,
    files: /\.sql$/,
    detected: 'Non-trivial SQL (joins, aggregation, or window functions)',
    why: 'Separates real analytical SQL from single-table CRUD.',
  },
];

const testSignals: CodeSignal[] = [
  {
    pattern: /\b(?:describe|it|test)\s*\(\s*[`'"]/,
    files: /(\.test\.|\.spec\.|(^|\/)(tests?|__tests__)\/)/,
    detected: 'Automated test case',
    why: 'Executable tests show the behaviour is verified, not just written.',
  },
  {
    pattern: /\bdef\s+test_\w+\s*\(|\b@pytest\.mark\./,
    detected: 'Python test case',
    why: 'Executable tests show the behaviour is verified, not just written.',
  },
  {
    pattern: /\bfunc\s+Test\w+\s*\(\s*\w+\s+\*testing\.T|\b@Test\b/,
    detected: 'Test function',
    why: 'Executable tests show the behaviour is verified, not just written.',
  },
];

const authSecuritySignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:jwt|jsonwebtoken)\s*\.\s*(?:sign|verify|decode)\s*\(|\bjwt_required\b|\bJwtUtils\b/i,
    detected: 'JSON Web Token issuing or verification',
    why: 'Token handling is core authentication work rather than a copied login form.',
  },
  {
    pattern:
      /\b(?:bcrypt|argon2|scrypt|pbkdf2)\w*\s*\.\s*(?:hash|compare|verify)|\bgenerateSalt\b/i,
    detected: 'Password hashing',
    why: 'Correct credential storage is a concrete security-engineering signal.',
  },
  {
    pattern:
      /\b(?:oauth2?|passport|authorize|requireAuth|isAuthenticated|@PreAuthorize)\b/i,
    detected: 'Authorization or OAuth flow',
    why: 'Shows access control was designed rather than assumed.',
  },
  {
    pattern:
      /\bcrypto\s*\.\s*(?:createHash|createHmac|randomBytes)|\bFernet\s*\(|\bAES\b/,
    detected: 'Cryptographic primitive usage',
    why: 'Encryption and signing work is meaningful security evidence.',
  },
];

const dataFrameSignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:pd|pandas)\s*\.\s*(?:read_csv|read_parquet|read_sql|DataFrame|concat|merge)\s*\(/,
    detected: 'pandas data loading or reshaping',
    why: 'Concrete tabular data manipulation rather than a generic script.',
  },
  {
    pattern:
      /\.\s*(?:groupby|pivot_table|resample|rolling|merge|dropna|fillna)\s*\(/,
    files: /\.(py|ipynb)$/,
    detected: 'DataFrame transformation',
    why: 'Aggregation and cleaning steps show real analytical work on messy data.',
  },
];

const numericSignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:np|numpy)\s*\.\s*(?:array|zeros|linspace|dot|matmul|linalg|random|vectorize)\b/,
    detected: 'NumPy numerical computation',
    why: 'Vectorised numerical code is the working language of quantitative roles.',
  },
  {
    pattern:
      /\bfrom\s+scipy(?:\.\w+)?\s+import\b|\bscipy\s*\.\s*(?:optimize|stats|signal|integrate|interpolate)\b/,
    detected: 'SciPy scientific computing',
    why: 'Shows use of established numerical methods instead of hand-rolled approximations.',
  },
  {
    pattern: /#include\s*<(?:Eigen|armadillo|cmath|numeric|valarray)/,
    detected: 'C++ numerical library usage',
    why: 'Native numerical code is strong evidence of performance-oriented programming.',
  },
];

const statisticsSignals: CodeSignal[] = [
  {
    pattern: /\bscipy\s*\.\s*stats\s*\.|\bstatsmodels\b|\bfrom\s+statsmodels\b/,
    detected: 'Statistical modelling library usage',
    why: 'Formal statistics rather than eyeballed summaries.',
  },
  {
    pattern:
      /\b(?:mean|median|std|variance|stdev|percentile|quantile|zscore|correlation|covariance)\s*\(/i,
    files: /\.(py|ipynb|r|cpp|ts|js)$/,
    detected: 'Descriptive statistics computation',
    why: 'Quantitative reasoning applied to data in code.',
  },
  {
    pattern:
      /\b(?:monte[_\s]?carlo|normal|lognormal|poisson|binomial|distribution|probability)\b/i,
    files: /\.(py|ipynb|r|cpp)$/,
    detected: 'Probability or simulation concept in code',
    why: 'Probabilistic modelling is a core quantitative skill.',
  },
];

const timeSeriesSignals: CodeSignal[] = [
  {
    pattern: /\.\s*(?:resample|rolling|ewm|shift|pct_change|diff)\s*\(/,
    detected: 'Time-series transformation',
    why: 'Window and lag operations are specific to time-series analysis.',
  },
  {
    pattern:
      /\b(?:ARIMA|SARIMAX|seasonal_decompose|autocorrelation|acf|pacf)\b/i,
    detected: 'Time-series model or diagnostic',
    why: 'Named time-series methods show formal training applied in code.',
  },
  {
    pattern:
      /\b(?:DatetimeIndex|to_datetime|set_index\s*\(\s*['"](?:date|time|timestamp))/i,
    detected: 'Time-indexed dataset construction',
    why: 'Correct time indexing is a prerequisite for defensible time-series work.',
  },
];

const marketDataSignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:yfinance|yahoo_fin|alpha_vantage|polygon|quandl|ccxt|iexfinance|tradingview)\b/i,
    detected: 'Market data provider integration',
    why: 'Real market data pulls are much stronger than synthetic price examples.',
  },
  {
    pattern:
      /\b(?:ohlc|open_high_low|bid_ask|order_book|ticker|candlestick|adj_close|adjusted_close)\b/i,
    detected: 'Market data structure',
    why: 'Domain-specific data shapes show genuine financial-data familiarity.',
  },
];

const backtestSignals: CodeSignal[] = [
  {
    pattern: /\b(?:backtrader|vectorbt|zipline|pyfolio|backtest(?:ing|er)?)\b/i,
    detected: 'Strategy backtesting',
    why: 'Backtesting is the defining workflow of quantitative strategy development.',
  },
  {
    // "alpha" and "beta" are deliberately excluded: they match version strings and greek
    // variable names far more often than they indicate risk analysis.
    pattern:
      /\b(?:sharpe|sortino|max_drawdown|drawdown|pnl|profit_and_loss|cagr|excess_return)\b/i,
    files: /\.(py|ipynb|cpp|ts|js|r)$/,
    detected: 'Risk or performance metric',
    why: 'Named risk metrics show results are evaluated the way desks evaluate them.',
  },
];

const optimizationSignals: CodeSignal[] = [
  {
    pattern:
      /\bscipy\s*\.\s*optimize\b|\bcvxpy\b|\bpulp\b|\bgurobipy\b|\bminimize\s*\(/,
    detected: 'Numerical optimization',
    why: 'Constrained optimization is central to portfolio and pricing work.',
  },
  {
    pattern:
      /\b(?:gradient_descent|newton_raphson|simplex|linear_programming|convex)\b/i,
    detected: 'Optimization algorithm',
    why: 'Named methods show algorithmic depth beyond library defaults.',
  },
];

const performanceSignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:numba|cython|@njit|@jit|multiprocessing|concurrent\.futures|ThreadPoolExecutor)\b/,
    detected: 'Performance-oriented execution',
    why: 'Explicit speed work signals awareness of latency and throughput constraints.',
  },
  {
    pattern:
      /\b(?:std::(?:vector|thread|atomic|chrono)|#pragma\s+omp|reserve\s*\(|memcpy)\b/,
    detected: 'Low-level performance construct',
    why: 'Native memory and concurrency control is strong performance evidence.',
  },
  {
    pattern: /\b(?:benchmark|timeit|perf_counter|profiler|cProfile)\b/i,
    detected: 'Benchmarking or profiling',
    why: 'Measuring before optimizing is a mature engineering habit.',
  },
];

const paymentSignals: CodeSignal[] = [
  {
    pattern: /\b(?:stripe|paypal|braintree|adyen|razorpay|square)\b/i,
    detected: 'Payment provider integration',
    why: 'Payment rails are the defining integration of consumer FinTech products.',
  },
  {
    pattern:
      /\b(?:payment_intent|paymentIntent|charge|checkout_session|refund|payout|invoice)\b/i,
    detected: 'Payment lifecycle handling',
    why: 'Handling charges, refunds, and payouts shows real money-movement logic.',
  },
  {
    pattern:
      /\b(?:webhook|signature)\b.*\b(?:verify|validate|constructEvent)\b|constructEvent\s*\(/i,
    detected: 'Payment webhook verification',
    why: 'Verifying webhook signatures is the difference between a demo and a safe integration.',
  },
];

const bankingSignals: CodeSignal[] = [
  {
    pattern: /\b(?:plaid|teller|yodlee|truelayer|open_?banking)\b/i,
    detected: 'Banking data aggregation',
    why: 'Bank connectivity is a core FinTech capability with real compliance weight.',
  },
  {
    pattern:
      /\b(?:iban|swift_code|routing_number|sort_code|account_balance|ledger_entry|double_entry)\b/i,
    detected: 'Banking domain model',
    why: 'Domain-accurate fields show the data model was designed for finance.',
  },
  {
    pattern: /\b(?:debit|credit|balance|transaction|settlement|reconcil)\w*\b/i,
    files: /\.(ts|tsx|js|py|java|go|sql)$/,
    detected: 'Transaction and ledger logic',
    why: 'Balance and reconciliation logic is where FinTech correctness actually lives.',
  },
];

const dataPipelineSignals: CodeSignal[] = [
  {
    pattern: /\b(?:airflow|prefect|dagster|luigi|DAG\s*\(|@task\b|@flow\b)/,
    detected: 'Workflow orchestration',
    why: 'Scheduled DAGs show pipelines are operated, not run by hand.',
  },
  {
    pattern:
      /\b(?:kafka|rabbitmq|celery|sqs|pubsub|kinesis|redis\s*\.\s*(?:lpush|publish))\b/i,
    detected: 'Message queue or streaming integration',
    why: 'Asynchronous data movement is core data-engineering infrastructure.',
  },
  {
    pattern: /\b(?:spark|pyspark|dbt|dask|beam)\b/i,
    detected: 'Distributed processing framework',
    why: 'Shows experience with data volumes past a single machine.',
  },
  {
    pattern: /\b(?:extract|transform|load|etl|ingest|upsert)\w*\s*\(/i,
    files: /\.(py|ts|js|sql|scala|java)$/,
    detected: 'ETL stage implementation',
    why: 'Named pipeline stages show a deliberate data flow.',
  },
];

const mlSignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:torch|tensorflow|keras|sklearn|scikit-learn|xgboost|lightgbm|transformers)\b/,
    detected: 'Machine learning framework usage',
    why: 'Framework usage anchors ML claims to actual model code.',
  },
  {
    pattern:
      /\.\s*(?:fit|train|predict|evaluate|forward|backward)\s*\(|\btrain_test_split\s*\(/,
    detected: 'Model training or inference call',
    why: 'Shows a model lifecycle, not only a copied notebook cell.',
  },
  {
    pattern:
      /\b(?:accuracy_score|f1_score|precision|recall|roc_auc|confusion_matrix|cross_val_score)\b/,
    detected: 'Model evaluation metric',
    why: 'Measuring model quality separates experiments from demos.',
  },
  {
    pattern:
      /\b(?:openai|anthropic|langchain|llama_index|embedding|vector_?store|rag)\b/i,
    detected: 'LLM or retrieval pipeline component',
    why: 'Concrete evidence of applied LLM engineering.',
  },
];

const frontendSignals: CodeSignal[] = [
  {
    pattern:
      /\buse(?:State|Effect|Memo|Callback|Reducer|Context|Ref)\s*(?:<[^>]*>)?\s*\(/,
    detected: 'React hook usage',
    why: 'Component state and lifecycle handling is the substance of frontend work.',
  },
  {
    pattern: /\b(?:aria-[a-z]+|role\s*=\s*['"]|alt\s*=\s*['"]|tabIndex)/,
    files: /\.(tsx|jsx|html|vue|svelte)$/,
    detected: 'Accessibility attribute',
    why: 'Accessibility markup is a quality signal most portfolio projects miss.',
  },
  {
    pattern:
      /\b(?:@media|grid-template|flex-direction|clamp\s*\(|prefers-color-scheme)\b/,
    detected: 'Responsive or adaptive styling',
    why: 'Shows layout was designed across viewports rather than one screen size.',
  },
  {
    pattern:
      /\b(?:createContext|Provider|zustand|redux|useQuery|useMutation)\b/,
    detected: 'Client state or data-fetching management',
    why: 'State architecture is what separates a page from an application.',
  },
];

const infraSignals: CodeSignal[] = [
  {
    pattern: /^\s*(?:FROM|RUN|COPY|ENTRYPOINT|CMD)\s+/,
    files: /dockerfile|\.dockerfile$/,
    detected: 'Container image definition',
    why: 'Containerisation shows the project can be reproduced and deployed.',
  },
  {
    pattern:
      /\b(?:apiVersion|kind)\s*:\s*(?:Deployment|Service|Ingress|StatefulSet|ConfigMap)/,
    detected: 'Kubernetes manifest',
    why: 'Orchestration manifests are direct infrastructure-engineering evidence.',
  },
  {
    pattern:
      /\bresource\s+"[a-z_]+"\s+"[a-z_]+"\s*\{|\bprovider\s+"(?:aws|gcp|azurerm)"/,
    detected: 'Terraform infrastructure as code',
    why: 'Declarative infrastructure is a strong DevOps signal.',
  },
  {
    pattern: /\b(?:boto3|aws-sdk|@aws-sdk|google-cloud|azure-)\b/,
    detected: 'Cloud SDK usage',
    why: 'Shows direct work against cloud services.',
  },
];

const ciSignals: CodeSignal[] = [
  {
    pattern: /^\s*(?:jobs|steps|runs-on|uses)\s*:/,
    files: /^\.github\/workflows\//,
    detected: 'CI pipeline step',
    why: 'Automated checks prove quality gates run on every change.',
  },
];

const securityToolingSignals: CodeSignal[] = [
  {
    pattern:
      /\b(?:nmap|scapy|paramiko|pwntools|impacket|volatility|yara|pycryptodome)\b/i,
    detected: 'Security tooling library',
    why: 'Offensive and forensic libraries are specific to security work.',
  },
  {
    pattern:
      /\b(?:sql_?injection|xss|csrf|payload|exploit|vulnerab|cve-\d{4}|owasp)\w*\b/i,
    detected: 'Vulnerability concept in code or docs',
    why: 'Named vulnerability classes show applied security knowledge.',
  },
  {
    pattern:
      /\b(?:sanitiz|escape|validate_input|parameterized|prepared_statement|rate_?limit)\w*\b/i,
    detected: 'Defensive input handling',
    why: 'Mitigations in code are stronger evidence than a security-themed README.',
  },
];

const architectureSignals: CodeSignal[] = [
  {
    pattern: /\b(?:interface|abstract\s+class|implements|protocol\s+\w+)\b/,
    files: /\.(ts|tsx|java|cs|py|go)$/,
    detected: 'Explicit abstraction boundary',
    why: 'Interfaces and protocols show layering rather than one large module.',
  },
  {
    pattern:
      /\b(?:try\s*\{|except\s+\w*Error|catch\s*\(|rescue\b|if\s+err\s*!=\s*nil)/,
    detected: 'Error handling path',
    why: 'Handling failure cases is a production-mindedness signal.',
  },
];

/**
 * Skills every software career shares, so career maps only declare what is distinctive.
 */
function coreEngineeringSkills(weight: number): CareerSkill[] {
  return [
    {
      id: 'automated-testing',
      label: 'Automated testing',
      description: 'Executable tests that verify behaviour.',
      weight,
      dependencies: [
        'jest',
        'vitest',
        'pytest',
        'mocha',
        'junit',
        'testify',
        'rspec',
        'playwright',
      ],
      pathPatterns: [
        /(^|\/)(tests?|__tests__|spec)\//,
        /\.(test|spec)\.[cm]?[jt]sx?$/,
        /(^|\/)test_\w+\.py$/,
      ],
      codeSignals: testSignals,
    },
    {
      id: 'code-organization',
      label: 'Code structure and error handling',
      description: 'Module boundaries, abstractions, and failure paths.',
      weight,
      codeSignals: architectureSignals,
    },
  ];
}

export const careerSkillMaps: Record<CareerPath, CareerSkillMap> = {
  'software-engineering': {
    summary:
      'General software engineering weighs API design, data access, testing, structure, and automation.',
    skills: [
      {
        id: 'api-design',
        label: 'API and service design',
        description: 'Defining and serving an interface other code depends on.',
        weight: 3,
        topics: ['api', 'rest', 'graphql', 'grpc', 'microservices'],
        dependencies: [
          'express',
          'fastify',
          'fastapi',
          'flask',
          'gin',
          'spring-boot',
          'nestjs',
        ],
        codeSignals: [...httpServerSignals, ...httpClientSignals],
      },
      {
        id: 'data-persistence',
        label: 'Data modelling and persistence',
        description: 'Storing and querying data with an explicit schema.',
        weight: 2.5,
        languages: ['SQL', 'PLpgSQL'],
        topics: ['database', 'postgres', 'mysql', 'mongodb'],
        dependencies: [
          'prisma',
          'typeorm',
          'sqlalchemy',
          'knex',
          'mongoose',
          'pg',
          'sequelize',
        ],
        codeSignals: sqlSignals,
      },
      ...coreEngineeringSkills(3),
      {
        id: 'typed-languages',
        label: 'Production language fluency',
        description:
          'Working in a language commonly used for production systems.',
        weight: 2,
        languages: [
          'TypeScript',
          'Go',
          'Java',
          'Rust',
          'C#',
          'Python',
          'C++',
          'Kotlin',
        ],
      },
      {
        id: 'automation',
        label: 'Build and release automation',
        description: 'Continuous integration and reproducible builds.',
        weight: 2,
        pathPatterns: [/^\.github\/workflows\//, /dockerfile/i, /^makefile$/i],
        codeSignals: ciSignals,
      },
    ],
  },

  'frontend-engineering': {
    summary:
      'Frontend relevance weighs component architecture, state management, styling systems, and accessibility.',
    skills: [
      {
        id: 'component-architecture',
        label: 'Component architecture',
        description: 'Composable UI built from stateful components.',
        weight: 3,
        languages: ['TypeScript', 'JavaScript', 'Vue', 'Svelte'],
        topics: ['react', 'vue', 'svelte', 'nextjs', 'frontend'],
        dependencies: [
          'react',
          'vue',
          'svelte',
          'next',
          'solid-js',
          '@angular/core',
        ],
        codeSignals: frontendSignals,
      },
      {
        id: 'styling-systems',
        label: 'Styling and design systems',
        description: 'Consistent, responsive visual implementation.',
        weight: 2.5,
        languages: ['CSS', 'SCSS', 'HTML'],
        topics: ['tailwind', 'css', 'design-system', 'ui'],
        dependencies: [
          'tailwindcss',
          'styled-components',
          'sass',
          '@emotion/react',
          'stitches',
        ],
        pathPatterns: [/\.(css|scss|sass)$/, /tailwind\.config\./],
      },
      {
        id: 'client-data',
        label: 'Client data fetching',
        description: 'Loading, caching, and error states for remote data.',
        weight: 2.5,
        dependencies: [
          '@tanstack/react-query',
          'swr',
          'apollo-client',
          'axios',
          'redux',
          'zustand',
        ],
        codeSignals: httpClientSignals,
      },
      {
        id: 'accessibility',
        label: 'Accessibility',
        description: 'Semantic markup and assistive-technology support.',
        weight: 2,
        topics: ['accessibility', 'a11y'],
        codeSignals: [
          {
            pattern:
              /\baria-[a-z]+\s*=|\brole\s*=\s*['"]|\bhtmlFor\s*=|\balt\s*=\s*['"][^'"]+['"]/,
            files: /\.(tsx|jsx|html|vue|svelte)$/,
            detected: 'Accessible markup attribute',
            why: 'Labels, roles, and alt text show interfaces built for assistive technology.',
          },
        ],
      },
      ...coreEngineeringSkills(2.5),
    ],
  },

  'backend-engineering': {
    summary:
      'Backend relevance weighs API surfaces, persistence, authentication, and operational readiness.',
    skills: [
      {
        id: 'api-design',
        label: 'API and service design',
        description: 'Serving a documented HTTP or RPC interface.',
        weight: 3,
        topics: ['api', 'rest', 'graphql', 'grpc', 'backend', 'microservices'],
        dependencies: [
          'express',
          'fastify',
          'nestjs',
          'fastapi',
          'flask',
          'django',
          'gin',
          'spring-boot',
        ],
        codeSignals: httpServerSignals,
      },
      {
        id: 'data-persistence',
        label: 'Databases and data modelling',
        description: 'Schema design, queries, and migrations.',
        weight: 3,
        languages: ['SQL', 'PLpgSQL'],
        topics: ['postgres', 'mysql', 'mongodb', 'redis', 'database'],
        dependencies: [
          'prisma',
          'typeorm',
          'sqlalchemy',
          'alembic',
          'knex',
          'pg',
          'mongoose',
          'gorm',
        ],
        pathPatterns: [/migrations?\//, /schema\.(sql|prisma)$/],
        codeSignals: sqlSignals,
      },
      {
        id: 'auth-security',
        label: 'Authentication and security',
        description: 'Identity, access control, and credential handling.',
        weight: 2.5,
        topics: ['auth', 'oauth', 'jwt', 'security'],
        dependencies: [
          'jsonwebtoken',
          'passport',
          'bcrypt',
          'argon2',
          'authlib',
          'spring-security',
        ],
        codeSignals: authSecuritySignals,
      },
      {
        id: 'async-processing',
        label: 'Background and async processing',
        description: 'Queues, workers, and scheduled jobs.',
        weight: 2,
        dependencies: [
          'bullmq',
          'celery',
          'sidekiq',
          'kafkajs',
          'amqplib',
          'redis',
        ],
        codeSignals: dataPipelineSignals.slice(1, 2),
      },
      ...coreEngineeringSkills(3),
      {
        id: 'operability',
        label: 'Operability',
        description: 'Configuration, logging, containerisation, and CI.',
        weight: 2,
        pathPatterns: [
          /^\.github\/workflows\//,
          /dockerfile/i,
          /\.env\.example$/,
        ],
        codeSignals: [...ciSignals, ...infraSignals.slice(0, 1)],
      },
    ],
  },

  'full-stack-engineering': {
    summary:
      'Full-stack relevance requires evidence on both sides of the wire: UI, API, and the data behind it.',
    skills: [
      {
        id: 'component-architecture',
        label: 'Frontend implementation',
        description: 'Component-based UI with real state handling.',
        weight: 2.5,
        topics: ['react', 'vue', 'nextjs', 'frontend'],
        dependencies: ['react', 'vue', 'next', 'svelte'],
        codeSignals: frontendSignals,
      },
      {
        id: 'api-design',
        label: 'Backend API',
        description: 'Server-side routes backing the interface.',
        weight: 2.5,
        topics: ['api', 'backend', 'fullstack'],
        dependencies: [
          'express',
          'fastify',
          'nestjs',
          'fastapi',
          'flask',
          'django',
        ],
        codeSignals: httpServerSignals,
      },
      {
        id: 'data-persistence',
        label: 'Databases',
        description: 'Persistent storage with a defined schema.',
        weight: 2.5,
        languages: ['SQL'],
        dependencies: [
          'prisma',
          'typeorm',
          'sqlalchemy',
          'mongoose',
          'pg',
          'supabase',
        ],
        pathPatterns: [/migrations?\//, /schema\.(sql|prisma)$/],
        codeSignals: sqlSignals,
      },
      {
        id: 'end-to-end-integration',
        label: 'End-to-end integration',
        description: 'The client and server actually talk to each other.',
        weight: 2.5,
        codeSignals: httpClientSignals,
      },
      {
        id: 'auth-security',
        label: 'Authentication',
        description: 'Sessions, tokens, or managed identity.',
        weight: 2,
        dependencies: [
          'next-auth',
          'jsonwebtoken',
          'passport',
          'clerk',
          'supabase',
          'firebase',
        ],
        codeSignals: authSecuritySignals,
      },
      ...coreEngineeringSkills(2.5),
    ],
  },

  'machine-learning-ai': {
    summary:
      'ML relevance weighs model implementation, data preparation, evaluation, and reproducibility.',
    skills: [
      {
        id: 'model-development',
        label: 'Model development',
        description: 'Building and training models in a real framework.',
        weight: 3,
        languages: ['Python', 'Jupyter Notebook'],
        topics: [
          'machine-learning',
          'deep-learning',
          'pytorch',
          'tensorflow',
          'ai',
          'llm',
        ],
        dependencies: [
          'torch',
          'tensorflow',
          'keras',
          'scikit-learn',
          'xgboost',
          'lightgbm',
          'transformers',
        ],
        codeSignals: mlSignals,
      },
      {
        id: 'data-preparation',
        label: 'Data preparation',
        description: 'Cleaning, splitting, and feature engineering.',
        weight: 2.5,
        dependencies: ['pandas', 'numpy', 'polars', 'datasets'],
        codeSignals: [...dataFrameSignals, ...numericSignals.slice(0, 1)],
      },
      {
        id: 'evaluation',
        label: 'Evaluation and metrics',
        description: 'Measuring model quality with named metrics.',
        weight: 3,
        codeSignals: [
          {
            pattern:
              /\b(?:accuracy_score|f1_score|precision_score|recall_score|roc_auc|confusion_matrix|cross_val_score|classification_report)\b/,
            detected: 'Model evaluation metric',
            why: 'Reporting measured quality is what makes an ML result credible.',
          },
          {
            pattern:
              /\b(?:val_loss|validation_split|early_stopping|KFold|StratifiedKFold)\b/,
            detected: 'Validation strategy',
            why: 'Guarding against overfitting shows methodological care.',
          },
        ],
      },
      {
        id: 'experiment-tracking',
        label: 'Experiment reproducibility',
        description: 'Seeds, configs, and tracked runs.',
        weight: 2,
        dependencies: ['mlflow', 'wandb', 'hydra-core', 'dvc'],
        codeSignals: [
          {
            pattern:
              /\b(?:random_state|manual_seed|set_seed|np\.random\.seed)\s*\(/,
            detected: 'Deterministic seeding',
            why: 'Reproducible runs are a basic requirement for trustworthy results.',
          },
        ],
      },
      {
        id: 'inference-serving',
        label: 'Inference and serving',
        description: 'Making the model usable beyond a notebook.',
        weight: 2,
        dependencies: [
          'fastapi',
          'flask',
          'gradio',
          'streamlit',
          'bentoml',
          'onnxruntime',
        ],
        codeSignals: httpServerSignals,
      },
      ...coreEngineeringSkills(2),
    ],
  },

  'data-science': {
    summary:
      'Data science relevance weighs analysis depth, statistics, visualisation, and communicated findings.',
    skills: [
      {
        id: 'data-analysis',
        label: 'Data analysis',
        description: 'Loading, cleaning, and reshaping real datasets.',
        weight: 3,
        languages: ['Python', 'R', 'Jupyter Notebook', 'SQL'],
        topics: ['data-science', 'analytics', 'pandas', 'eda'],
        dependencies: ['pandas', 'numpy', 'polars', 'dplyr'],
        codeSignals: dataFrameSignals,
      },
      {
        id: 'statistics',
        label: 'Statistics and probability',
        description: 'Formal statistical reasoning applied to data.',
        weight: 3,
        dependencies: ['scipy', 'statsmodels', 'pymc'],
        codeSignals: statisticsSignals,
      },
      {
        id: 'visualization',
        label: 'Visualisation',
        description: 'Charts that support the stated conclusions.',
        weight: 2.5,
        topics: ['visualization', 'dataviz'],
        dependencies: [
          'matplotlib',
          'seaborn',
          'plotly',
          'altair',
          'ggplot2',
          'bokeh',
        ],
        codeSignals: [
          {
            pattern:
              /\b(?:plt|sns|px|alt|go)\s*\.\s*(?:plot|scatter|hist|bar|line|heatmap|figure|subplots)\s*\(/,
            detected: 'Chart construction',
            why: 'Visual output is how analytical findings get communicated.',
          },
        ],
      },
      {
        id: 'sql-analysis',
        label: 'SQL for analysis',
        description: 'Querying data at the source.',
        weight: 2,
        languages: ['SQL'],
        codeSignals: sqlSignals,
      },
      {
        id: 'notebook-narrative',
        label: 'Communicated findings',
        description: 'Written interpretation alongside the analysis.',
        weight: 2,
        pathPatterns: [/\.ipynb$/, /(^|\/)(notebooks?|analysis|reports?)\//],
      },
      ...coreEngineeringSkills(1.5),
    ],
  },

  'data-engineering': {
    summary:
      'Data engineering relevance weighs pipelines, orchestration, storage design, and data quality.',
    skills: [
      {
        id: 'pipelines',
        label: 'Pipelines and orchestration',
        description: 'Scheduled, repeatable data movement.',
        weight: 3,
        topics: ['data-engineering', 'etl', 'airflow', 'spark', 'dbt'],
        dependencies: [
          'apache-airflow',
          'prefect',
          'dagster',
          'dbt-core',
          'luigi',
        ],
        pathPatterns: [/(^|\/)(dags?|pipelines?|etl)\//],
        codeSignals: dataPipelineSignals,
      },
      {
        id: 'warehouse-modelling',
        label: 'Storage and warehouse modelling',
        description: 'Schemas, partitioning, and incremental loads.',
        weight: 3,
        languages: ['SQL'],
        topics: ['snowflake', 'bigquery', 'redshift', 'warehouse'],
        dependencies: [
          'snowflake-connector-python',
          'google-cloud-bigquery',
          'psycopg2',
          'duckdb',
        ],
        pathPatterns: [/models?\/.*\.sql$/, /migrations?\//],
        codeSignals: sqlSignals,
      },
      {
        id: 'distributed-processing',
        label: 'Distributed processing',
        description: 'Handling volumes beyond a single machine.',
        weight: 2.5,
        dependencies: ['pyspark', 'dask', 'apache-beam', 'ray'],
        codeSignals: dataPipelineSignals.slice(2, 3),
      },
      {
        id: 'data-quality',
        label: 'Data quality checks',
        description: 'Validation and monitoring of pipeline output.',
        weight: 2.5,
        dependencies: ['great-expectations', 'pandera', 'soda-core'],
        codeSignals: [
          {
            pattern:
              /\b(?:assert|expect|validate|check)\w*\s*\(.*(?:schema|column|not_null|unique|row_count)/i,
            detected: 'Data validation check',
            why: 'Explicit quality gates prevent silent pipeline corruption.',
          },
        ],
      },
      {
        id: 'infrastructure',
        label: 'Infrastructure and deployment',
        description: 'Containerised, configurable pipeline execution.',
        weight: 2,
        pathPatterns: [/dockerfile/i, /^\.github\/workflows\//, /\.tf$/],
        codeSignals: infraSignals,
      },
      ...coreEngineeringSkills(2),
    ],
  },

  cybersecurity: {
    summary:
      'Security relevance weighs vulnerability work, defensive implementation, cryptography, and tooling.',
    skills: [
      {
        id: 'security-tooling',
        label: 'Security tooling',
        description: 'Scanners, exploit tooling, or forensic analysis.',
        weight: 3,
        languages: ['Python', 'Go', 'C', 'C++', 'Rust', 'Shell'],
        topics: ['security', 'cybersecurity', 'ctf', 'pentesting'],
        dependencies: [
          'scapy',
          'pwntools',
          'paramiko',
          'impacket',
          'yara-python',
          'requests',
        ],
        codeSignals: securityToolingSignals,
      },
      {
        id: 'cryptography',
        label: 'Cryptography',
        description: 'Hashing, encryption, and key handling.',
        weight: 2.5,
        topics: ['cryptography', 'crypto', 'encryption'],
        dependencies: ['pycryptodome', 'cryptography', 'node-forge', 'openssl'],
        codeSignals: authSecuritySignals.slice(1),
      },
      {
        id: 'defensive-coding',
        label: 'Defensive implementation',
        description: 'Input validation, escaping, and rate limiting.',
        weight: 2.5,
        dependencies: ['zod', 'joi', 'helmet', 'express-rate-limit', 'bleach'],
        codeSignals: securityToolingSignals.slice(2),
      },
      {
        id: 'auth-security',
        label: 'Authentication and access control',
        description: 'Identity and permission enforcement.',
        weight: 2.5,
        codeSignals: authSecuritySignals,
      },
      {
        id: 'secure-config',
        label: 'Secrets and configuration hygiene',
        description: 'Secrets kept out of source control.',
        weight: 2,
        pathPatterns: [/\.env\.example$/, /^\.gitignore$/, /security\.md$/i],
      },
      ...coreEngineeringSkills(2),
    ],
  },

  'devops-cloud-engineering': {
    summary:
      'DevOps relevance weighs infrastructure as code, containerisation, CI/CD, and operational visibility.',
    skills: [
      {
        id: 'infrastructure-as-code',
        label: 'Infrastructure as code',
        description: 'Declarative, version-controlled infrastructure.',
        weight: 3,
        languages: ['HCL', 'Shell', 'Go', 'Python'],
        topics: ['terraform', 'devops', 'aws', 'kubernetes', 'infrastructure'],
        dependencies: ['boto3', 'aws-cdk-lib', 'pulumi', '@aws-sdk/client-s3'],
        pathPatterns: [/\.tf$/, /(^|\/)(terraform|infra|infrastructure)\//],
        codeSignals: infraSignals,
      },
      {
        id: 'containerisation',
        label: 'Containerisation',
        description: 'Reproducible runtime images and composition.',
        weight: 3,
        topics: ['docker', 'containers'],
        pathPatterns: [/dockerfile/i, /docker-compose\.ya?ml$/],
        codeSignals: infraSignals.slice(0, 2),
      },
      {
        id: 'ci-cd',
        label: 'CI/CD pipelines',
        description: 'Automated build, test, and deploy stages.',
        weight: 3,
        pathPatterns: [
          /^\.github\/workflows\//,
          /\.gitlab-ci\.ya?ml$/,
          /Jenkinsfile$/,
        ],
        codeSignals: ciSignals,
      },
      {
        id: 'observability',
        label: 'Observability',
        description: 'Logging, metrics, and health checks.',
        weight: 2,
        dependencies: [
          'prometheus-client',
          'pino',
          'winston',
          'opentelemetry-api',
        ],
        codeSignals: [
          {
            pattern:
              /\b(?:prometheus|grafana|opentelemetry|healthz|\/health\b|metrics\s*\.\s*(?:inc|observe|gauge))/i,
            detected: 'Monitoring or health-check instrumentation',
            why: 'Operational visibility is what separates deployed from operated.',
          },
        ],
      },
      {
        id: 'scripting',
        label: 'Automation scripting',
        description: 'Repeatable operational tasks in scripts.',
        weight: 2,
        pathPatterns: [/\.sh$/, /(^|\/)scripts?\//, /^makefile$/i],
      },
      ...coreEngineeringSkills(2),
    ],
  },

  'financial-technology': {
    summary:
      'FinTech relevance weighs money movement, financial data modelling, security, and production backend work.',
    skills: [
      {
        id: 'payments',
        label: 'Payments and transactions',
        description: 'Moving money through a payment provider or ledger.',
        weight: 3,
        topics: ['fintech', 'payments', 'stripe', 'billing'],
        dependencies: [
          'stripe',
          'braintree',
          'paypal-rest-sdk',
          'plaid',
          'square',
        ],
        codeSignals: paymentSignals,
      },
      {
        id: 'banking-domain',
        label: 'Banking and financial data modelling',
        description: 'Accounts, balances, ledgers, and reconciliation.',
        weight: 3,
        topics: ['banking', 'finance', 'ledger', 'accounting'],
        dependencies: ['plaid', 'truelayer', 'yodlee'],
        codeSignals: bankingSignals,
      },
      {
        id: 'auth-security',
        label: 'Authentication and security',
        description: 'Credential handling, access control, and encryption.',
        weight: 3,
        topics: ['auth', 'security', 'oauth', 'jwt'],
        dependencies: [
          'jsonwebtoken',
          'passport',
          'bcrypt',
          'argon2',
          'authlib',
          'spring-security',
        ],
        codeSignals: authSecuritySignals,
      },
      {
        id: 'api-services',
        label: 'API and backend services',
        description: 'Server-side services other systems call.',
        weight: 2.5,
        languages: ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'C#'],
        topics: ['api', 'backend', 'microservices'],
        dependencies: [
          'express',
          'fastify',
          'nestjs',
          'fastapi',
          'flask',
          'spring-boot',
          'gin',
        ],
        codeSignals: [...httpServerSignals, ...httpClientSignals],
      },
      {
        id: 'databases',
        label: 'Databases and transactional integrity',
        description: 'Schemas, migrations, and consistent writes.',
        weight: 2.5,
        languages: ['SQL'],
        topics: ['postgres', 'mysql', 'database'],
        dependencies: [
          'prisma',
          'typeorm',
          'sqlalchemy',
          'alembic',
          'knex',
          'pg',
          'hibernate',
        ],
        pathPatterns: [/migrations?\//, /schema\.(sql|prisma)$/],
        codeSignals: [
          ...sqlSignals,
          {
            pattern:
              /\b(?:BEGIN\s+TRANSACTION|COMMIT|ROLLBACK|\$transaction|session\.begin|@Transactional)\b/i,
            detected: 'Database transaction control',
            why: 'Atomic writes are non-negotiable when the rows represent money.',
          },
        ],
      },
      {
        id: 'financial-analytics',
        label: 'Financial analytics and market data',
        description: 'Portfolio, pricing, or market data analysis.',
        weight: 2,
        topics: ['trading', 'market-data', 'investing', 'crypto'],
        dependencies: ['pandas', 'numpy', 'yfinance', 'ccxt', 'alpha-vantage'],
        codeSignals: [...marketDataSignals, ...dataFrameSignals.slice(0, 1)],
      },
      {
        id: 'data-pipelines',
        label: 'Data pipelines',
        description: 'Scheduled ingestion and processing of financial data.',
        weight: 2,
        dependencies: ['apache-airflow', 'celery', 'kafka-python', 'prefect'],
        codeSignals: dataPipelineSignals,
      },
      {
        id: 'cloud-backend',
        label: 'Cloud and deployment',
        description: 'Containerised, deployable services.',
        weight: 2,
        topics: ['aws', 'gcp', 'azure', 'docker'],
        pathPatterns: [/dockerfile/i, /^\.github\/workflows\//, /\.tf$/],
        codeSignals: [...infraSignals.slice(0, 1), ...ciSignals],
      },
      ...coreEngineeringSkills(2.5),
    ],
  },

  'quantitative-development': {
    summary:
      'Quantitative development relevance weighs numerical computing, statistics, strategy evaluation, and performance-oriented code.',
    skills: [
      {
        id: 'numerical-computing',
        label: 'Numerical computing',
        description: 'Vectorised and matrix computation.',
        weight: 3,
        languages: ['Python', 'C++', 'C', 'Julia', 'R', 'Rust'],
        topics: ['numpy', 'scipy', 'numerical', 'simulation'],
        dependencies: ['numpy', 'scipy', 'eigen', 'numba', 'julia'],
        codeSignals: numericSignals,
      },
      {
        id: 'statistics-probability',
        label: 'Statistics and probability',
        description: 'Distributions, inference, and simulation.',
        weight: 3,
        topics: ['statistics', 'probability', 'monte-carlo'],
        dependencies: ['scipy', 'statsmodels', 'pymc', 'arch'],
        codeSignals: statisticsSignals,
      },
      {
        id: 'time-series',
        label: 'Time-series analysis',
        description: 'Lagged, windowed, and time-indexed analysis.',
        weight: 3,
        topics: ['time-series', 'forecasting'],
        dependencies: ['pandas', 'statsmodels', 'prophet', 'arch'],
        codeSignals: [...timeSeriesSignals, ...dataFrameSignals.slice(1)],
      },
      {
        id: 'backtesting',
        label: 'Backtesting and strategy evaluation',
        description: 'Measuring strategy performance and risk.',
        weight: 3,
        topics: ['backtesting', 'trading', 'algotrading', 'quant'],
        dependencies: [
          'backtrader',
          'vectorbt',
          'zipline',
          'pyfolio',
          'quantstats',
        ],
        codeSignals: backtestSignals,
      },
      {
        id: 'market-data',
        label: 'Financial and market data',
        description: 'Working with real instrument and price data.',
        weight: 2.5,
        topics: ['market-data', 'finance', 'stocks', 'crypto'],
        dependencies: [
          'yfinance',
          'ccxt',
          'alpha-vantage',
          'polygon-api-client',
          'pandas-datareader',
        ],
        codeSignals: marketDataSignals,
      },
      {
        id: 'optimization-algorithms',
        label: 'Algorithms and optimization',
        description:
          'Solvers, constrained optimization, and complexity-aware code.',
        weight: 2.5,
        topics: ['algorithms', 'optimization'],
        dependencies: ['cvxpy', 'pulp', 'gurobipy', 'scipy'],
        codeSignals: optimizationSignals,
      },
      {
        id: 'performance-programming',
        label: 'Performance-oriented programming',
        description: 'Latency, memory, and throughput awareness.',
        weight: 2.5,
        languages: ['C++', 'C', 'Rust'],
        topics: ['performance', 'low-latency', 'hft'],
        dependencies: ['numba', 'cython', 'joblib'],
        codeSignals: performanceSignals,
      },
      {
        id: 'sql-data-access',
        label: 'SQL and data access',
        description: 'Pulling analysis inputs from a database.',
        weight: 1.5,
        languages: ['SQL'],
        dependencies: ['sqlalchemy', 'psycopg2', 'duckdb', 'pyodbc'],
        codeSignals: sqlSignals,
      },
      ...coreEngineeringSkills(2),
    ],
  },
};

export function getCareerSkillMap(careerPath: CareerPath): CareerSkillMap {
  return careerSkillMaps[careerPath];
}
