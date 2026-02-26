#!/usr/bin/env npx tsx
// benchmarks/parse.bench.ts
// Issue #52: Performance benchmarks for markdown parsing
//
// Measures parsing performance (regex extraction + marked HTML conversion)
// without full Puppeteer rendering.  Run with:
//   npm run benchmark

import { performance } from 'node:perf_hooks';
import { marked } from 'marked';

// ---------------------------------------------------------------------------
// The same regex used by the converter to find mermaid blocks.
// ---------------------------------------------------------------------------
const MERMAID_REGEX = /```mermaid\r?\n([\s\S]*?)```/g;

// ---------------------------------------------------------------------------
// Benchmark document generators
// ---------------------------------------------------------------------------

function generateFlowchart(nodeCount: number): string {
    const lines = ['flowchart TD'];
    for (let i = 0; i < nodeCount; i++) {
        lines.push(`    N${i}[Node ${i}] --> N${i + 1}[Node ${i + 1}]`);
    }
    return lines.join('\n');
}

function generateSequence(actorCount: number): string {
    const lines = ['sequenceDiagram'];
    const actors = Array.from({ length: actorCount }, (_, i) => `Actor${i}`);
    for (let i = 0; i < actors.length - 1; i++) {
        lines.push(`    ${actors[i]}->>+${actors[i + 1]}: Request ${i}`);
        lines.push(`    ${actors[i + 1]}-->>-${actors[i]}: Response ${i}`);
    }
    return lines.join('\n');
}

function buildDocument(diagramCount: number): string {
    const sections: string[] = ['# Benchmark Document\n'];

    for (let i = 0; i < diagramCount; i++) {
        sections.push(`## Section ${i + 1}\n`);
        sections.push('Some prose text explaining the diagram below. '.repeat(5) + '\n');

        // Alternate between flowchart and sequence diagram types
        const diagram = i % 2 === 0
            ? generateFlowchart(10)
            : generateSequence(6);

        sections.push('```mermaid');
        sections.push(diagram);
        sections.push('```\n');
        sections.push('Additional commentary after the diagram.\n');
    }

    return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Benchmark runner
// ---------------------------------------------------------------------------

interface BenchmarkResult {
    name: string;
    documentSizeKB: number;
    diagramCount: number;
    iterations: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    medianMs: number;
    p95Ms: number;
}

async function runBenchmark(
    name: string,
    fn: () => void | Promise<void>,
    iterations: number = 100,
): Promise<Omit<BenchmarkResult, 'documentSizeKB' | 'diagramCount'>> {
    const durations: number[] = [];

    // Warm-up (3 iterations)
    for (let i = 0; i < 3; i++) {
        await fn();
    }

    // Measured iterations
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        const end = performance.now();
        durations.push(end - start);
    }

    durations.sort((a, b) => a - b);

    return {
        name,
        iterations,
        avgMs: durations.reduce((s, d) => s + d, 0) / durations.length,
        minMs: durations[0],
        maxMs: durations[durations.length - 1],
        medianMs: durations[Math.floor(durations.length / 2)],
        p95Ms: durations[Math.floor(durations.length * 0.95)],
    };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const configs = [
        { diagramCount: 1,  label: '1 diagram' },
        { diagramCount: 5,  label: '5 diagrams' },
        { diagramCount: 10, label: '10 diagrams' },
    ];

    const results: BenchmarkResult[] = [];

    console.log('='.repeat(72));
    console.log('  Markdown Parsing Benchmarks');
    console.log('='.repeat(72));
    console.log();

    for (const { diagramCount, label } of configs) {
        const doc = buildDocument(diagramCount);
        const docSizeKB = Buffer.byteLength(doc, 'utf-8') / 1024;

        // Benchmark 1: Mermaid regex extraction
        const regexResult = await runBenchmark(
            `regex extraction (${label})`,
            () => { [...doc.matchAll(MERMAID_REGEX)]; },
        );

        results.push({
            ...regexResult,
            documentSizeKB: docSizeKB,
            diagramCount,
        });

        // Benchmark 2: Full marked HTML conversion
        const markedResult = await runBenchmark(
            `marked HTML parse (${label})`,
            async () => { await marked(doc, { gfm: true }); },
        );

        results.push({
            ...markedResult,
            documentSizeKB: docSizeKB,
            diagramCount,
        });

        // Benchmark 3: Combined (extract + marked)
        const combinedResult = await runBenchmark(
            `extract + parse  (${label})`,
            async () => {
                const matches = [...doc.matchAll(MERMAID_REGEX)];
                // Simulate replacing mermaid blocks with placeholder HTML
                let processed = doc;
                for (let j = matches.length - 1; j >= 0; j--) {
                    const m = matches[j];
                    const start = m.index!;
                    const end = start + m[0].length;
                    processed = processed.slice(0, start) +
                        '<div class="mermaid-diagram">placeholder</div>' +
                        processed.slice(end);
                }
                await marked(processed, { gfm: true });
            },
        );

        results.push({
            ...combinedResult,
            documentSizeKB: docSizeKB,
            diagramCount,
        });
    }

    // Print results table
    console.log();
    const header = [
        'Benchmark'.padEnd(40),
        'Doc KB'.padStart(8),
        'Avg(ms)'.padStart(10),
        'Med(ms)'.padStart(10),
        'P95(ms)'.padStart(10),
        'Min(ms)'.padStart(10),
        'Max(ms)'.padStart(10),
    ].join(' | ');

    console.log(header);
    console.log('-'.repeat(header.length));

    for (const r of results) {
        console.log([
            r.name.padEnd(40),
            r.documentSizeKB.toFixed(1).padStart(8),
            r.avgMs.toFixed(3).padStart(10),
            r.medianMs.toFixed(3).padStart(10),
            r.p95Ms.toFixed(3).padStart(10),
            r.minMs.toFixed(3).padStart(10),
            r.maxMs.toFixed(3).padStart(10),
        ].join(' | '));
    }

    console.log();
    console.log('='.repeat(72));
    console.log(`  ${results.length} benchmarks completed (${results[0].iterations} iterations each)`);
    console.log('='.repeat(72));

    // Write baseline JSON
    const baselinePath = new URL('./baseline.json', import.meta.url).pathname;
    const baseline = results.map(r => ({
        name: r.name,
        documentSizeKB: parseFloat(r.documentSizeKB.toFixed(1)),
        diagramCount: r.diagramCount,
        avgMs: parseFloat(r.avgMs.toFixed(3)),
        medianMs: parseFloat(r.medianMs.toFixed(3)),
        p95Ms: parseFloat(r.p95Ms.toFixed(3)),
    }));

    const { promises: fs } = await import('fs');
    await fs.writeFile(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`\nBaseline written to ${baselinePath}`);
}

main().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
