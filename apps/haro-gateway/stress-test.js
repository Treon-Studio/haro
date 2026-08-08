import { performance } from 'perf_hooks';

const TARGET_URL = 'http://localhost:8787/';
const CONCURRENCY = 100;

console.log(`🚀 Starting base router stress test on: ${TARGET_URL}`);
console.log(`🔥 Sending ${CONCURRENCY} concurrent requests...`);

async function run() {
  const start = performance.now();
  
  const requests = Array.from({ length: CONCURRENCY }).map(async (_, idx) => {
    const reqStart = performance.now();
    try {
      const res = await fetch(TARGET_URL);
      const reqEnd = performance.now();
      return {
        status: res.status,
        latency: reqEnd - reqStart,
        success: res.ok
      };
    } catch (err) {
      const reqEnd = performance.now();
      return {
        status: 0,
        latency: reqEnd - reqStart,
        success: false,
        error: err.message
      };
    }
  });

  const results = await Promise.all(requests);
  const totalDuration = performance.now() - start;

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const latencies = results.map(r => r.latency);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  console.log('\n📊 --- STRESS TEST RESULTS ---');
  console.log(`⏱️  Total Duration: ${totalDuration.toFixed(2)} ms`);
  console.log(`✅ Successful Requests: ${successful}/${CONCURRENCY}`);
  console.log(`❌ Failed Requests: ${failed}/${CONCURRENCY}`);
  console.log(`⚡ Avg Latency per Request: ${avgLatency.toFixed(2)} ms`);
  console.log(`📉 Min Latency: ${minLatency.toFixed(2)} ms`);
  console.log(`📈 Max Latency: ${maxLatency.toFixed(2)} ms`);
  console.log(`📊 Throughput: ${(CONCURRENCY / (totalDuration / 1000)).toFixed(2)} req/sec`);
  
  if (failed > 0) {
    console.log('\n⚠️  Errors:');
    const uniqueErrors = [...new Set(results.filter(r => r.error).map(r => r.error))];
    uniqueErrors.forEach(err => console.log(`   - ${err}`));
  }
}

run().catch(console.error);
