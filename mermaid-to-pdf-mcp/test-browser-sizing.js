import { MermaidConverter } from './dist/converter.js';

// Create logger that shows all output
const logger = {
  info: (obj, msg) => console.log('[INFO]', msg || '', JSON.stringify(obj, null, 2)),
  error: (obj, msg) => console.error('[ERROR]', msg || '', obj),
  warn: (obj, msg) => console.warn('[WARN]', msg || '', obj),
  debug: (obj, msg) => console.log('[DEBUG]', msg || '', obj)
};

const converter = new MermaidConverter(logger);

const testDiagrams = [
  {
    name: 'Simple Stoplight',
    code: `flowchart TD
    A[Red] --> B[Yellow]
    B --> C[Green]`
  },
  {
    name: 'Complex Architecture',
    code: `flowchart LR
    A[Frontend] --> B[API Gateway]
    B --> C[Auth Service]
    B --> D[User Service]
    B --> E[Order Service]
    C --> F[(Auth DB)]
    D --> G[(User DB)]
    E --> H[(Order DB)]
    E --> I[Payment Service]
    I --> J[Stripe API]
    E --> K[Inventory Service]
    K --> L[(Inventory DB)]`
  },
  {
    name: 'Wide Sequence',
    code: `sequenceDiagram
    participant U as User
    participant W as WebApp
    participant A as API
    participant D as Database
    participant C as Cache
    participant Q as Queue
    U->>W: Request
    W->>A: Process
    A->>D: Query
    A->>C: Cache
    A->>Q: Enqueue`
  }
];

async function testDynamicSizing() {
  console.log('=== Testing Dynamic Diagram Sizing ===\n');
  
  for (const test of testDiagrams) {
    console.log(`\n📊 Testing: ${test.name}`);
    console.log('─'.repeat(40));
    
    try {
      // Force browser rendering to see dynamic sizing in action
      await converter.renderMermaidDiagram(test.code, 'png', 'A4');
      console.log('✅ Success\n');
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  await converter.cleanup();
  console.log('\n✨ Testing complete!');
}

testDynamicSizing().catch(console.error);