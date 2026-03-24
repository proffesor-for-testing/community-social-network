import { Injectable, OnModuleInit } from '@nestjs/common';

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramData {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

/**
 * In-memory Prometheus-compatible metrics service.
 * Tracks HTTP request counters, duration histograms, and active connections.
 * Does NOT require prom-client; uses simple in-memory data structures.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  /** Counter: http_requests_total{method, path, status} */
  private readonly requestCounters = new Map<string, number>();

  /** Histogram: http_request_duration_seconds{method, path} */
  private readonly durationHistograms = new Map<string, HistogramData>();

  /** Gauge: active_connections */
  private activeConnections = 0;

  /** Histogram bucket boundaries in seconds */
  private readonly bucketBoundaries = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  onModuleInit(): void {
    // Metrics are initialized lazily on first use
  }

  /**
   * Records an HTTP request with its method, path, status code, and duration.
   */
  recordRequest(method: string, path: string, statusCode: number, durationMs: number): void {
    // Normalize path to reduce cardinality (replace UUIDs and numeric IDs)
    const normalizedPath = this.normalizePath(path);

    // Increment counter
    const counterKey = `${method}|${normalizedPath}|${statusCode}`;
    this.requestCounters.set(counterKey, (this.requestCounters.get(counterKey) || 0) + 1);

    // Record in histogram
    const histKey = `${method}|${normalizedPath}`;
    const durationSec = durationMs / 1000;

    if (!this.durationHistograms.has(histKey)) {
      this.durationHistograms.set(histKey, {
        buckets: this.bucketBoundaries.map((le) => ({ le, count: 0 })),
        sum: 0,
        count: 0,
      });
    }

    const hist = this.durationHistograms.get(histKey)!;
    hist.sum += durationSec;
    hist.count += 1;
    for (const bucket of hist.buckets) {
      if (durationSec <= bucket.le) {
        bucket.count += 1;
      }
    }
  }

  incrementConnections(): void {
    this.activeConnections += 1;
  }

  decrementConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  getActiveConnections(): number {
    return this.activeConnections;
  }

  /**
   * Returns all metrics in Prometheus exposition format.
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    // http_requests_total counter
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    for (const [key, count] of this.requestCounters.entries()) {
      const [method, path, status] = key.split('|');
      lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
    }

    // http_request_duration_seconds histogram
    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds histogram');
    for (const [key, hist] of this.durationHistograms.entries()) {
      const [method, path] = key.split('|');
      for (const bucket of hist.buckets) {
        lines.push(
          `http_request_duration_seconds_bucket{method="${method}",path="${path}",le="${bucket.le}"} ${bucket.count}`,
        );
      }
      lines.push(
        `http_request_duration_seconds_bucket{method="${method}",path="${path}",le="+Inf"} ${hist.count}`,
      );
      lines.push(
        `http_request_duration_seconds_sum{method="${method}",path="${path}"} ${hist.sum}`,
      );
      lines.push(
        `http_request_duration_seconds_count{method="${method}",path="${path}"} ${hist.count}`,
      );
    }

    // active_connections gauge
    lines.push('# HELP active_connections Number of currently active connections');
    lines.push('# TYPE active_connections gauge');
    lines.push(`active_connections ${this.activeConnections}`);

    return lines.join('\n') + '\n';
  }

  /**
   * Normalize paths to reduce cardinality.
   * Replaces UUIDs and numeric IDs with placeholders.
   */
  private normalizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
