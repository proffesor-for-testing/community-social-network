import { registerAs } from '@nestjs/config';

export const TRACING_CONFIG_KEY = 'tracing';

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  exporterEndpoint: string;
  sampleRate: number;
}

export const tracingConfig = registerAs(TRACING_CONFIG_KEY, (): TracingConfig => ({
  enabled: process.env['TRACING_ENABLED'] === 'true',
  serviceName: process.env['TRACING_SERVICE_NAME'] || 'csn-api',
  exporterEndpoint: process.env['OTEL_EXPORTER_ENDPOINT'] || 'http://localhost:4318/v1/traces',
  sampleRate: parseFloat(process.env['TRACING_SAMPLE_RATE'] || '1.0'),
}));

/**
 * Manual span tracking for request tracing.
 * This is a lightweight stub that works without OpenTelemetry SDK installed.
 * In production, replace with actual OTEL instrumentation.
 */
export class ManualSpan {
  readonly traceId: string;
  readonly spanId: string;
  readonly name: string;
  readonly startTime: number;
  private endTime?: number;
  private attributes: Record<string, string | number | boolean> = {};
  private _status: 'ok' | 'error' = 'ok';

  constructor(name: string, traceId?: string) {
    this.name = name;
    this.traceId = traceId || ManualSpan.generateId(32);
    this.spanId = ManualSpan.generateId(16);
    this.startTime = Date.now();
  }

  setAttribute(key: string, value: string | number | boolean): this {
    this.attributes[key] = value;
    return this;
  }

  setStatus(status: 'ok' | 'error'): this {
    this._status = status;
    return this;
  }

  end(): this {
    this.endTime = Date.now();
    return this;
  }

  get duration(): number {
    return (this.endTime || Date.now()) - this.startTime;
  }

  toJSON(): Record<string, unknown> {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      attributes: this.attributes,
      status: this._status,
    };
  }

  private static generateId(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}
