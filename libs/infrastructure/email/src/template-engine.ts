import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple Handlebars-compatible template engine.
 * Implements core Handlebars syntax: {{ variable }}, {{#if}}, {{#each}}, {{#unless}}.
 * Does NOT require the handlebars package - uses a lightweight built-in parser.
 */
@Injectable()
export class TemplateEngine {
  private readonly logger = new Logger(TemplateEngine.name);
  private readonly templateCache = new Map<string, string>();
  private readonly templateDir: string;

  constructor() {
    this.templateDir = path.resolve(__dirname, 'templates');
  }

  /**
   * Renders a named template with the given context data.
   */
  async render(templateName: string, context: Record<string, unknown>): Promise<string> {
    const template = await this.loadTemplate(templateName);
    return this.compile(template, context);
  }

  /**
   * Renders a template string directly (not from file).
   */
  renderString(template: string, context: Record<string, unknown>): string {
    return this.compile(template, context);
  }

  /**
   * Loads a template file, using cache for subsequent calls.
   */
  private async loadTemplate(name: string): Promise<string> {
    const cached = this.templateCache.get(name);
    if (cached) return cached;

    const filePath = path.join(this.templateDir, `${name}.hbs`);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.templateCache.set(name, content);
      return content;
    } catch (error) {
      this.logger.error(`Failed to load template: ${name}`, error);
      throw new Error(`Template not found: ${name}`);
    }
  }

  /**
   * Compiles a Handlebars-like template with context data.
   * Supports: {{ var }}, {{ obj.prop }}, {{#if}}, {{#unless}}, {{#each}}, {{{ raw }}}.
   */
  compile(template: string, context: Record<string, unknown>): string {
    let result = template;

    // Process {{#each items}} ... {{/each}} blocks
    result = this.processEachBlocks(result, context);

    // Process {{#if condition}} ... {{else}} ... {{/if}} blocks
    result = this.processIfBlocks(result, context);

    // Process {{#unless condition}} ... {{/unless}} blocks
    result = this.processUnlessBlocks(result, context);

    // Process {{{ raw }}} (unescaped output)
    result = result.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_match, key: string) => {
      const value = this.resolve(key, context);
      return value != null ? String(value) : '';
    });

    // Process {{ variable }} (HTML-escaped output)
    result = result.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
      const value = this.resolve(key, context);
      return value != null ? this.escapeHtml(String(value)) : '';
    });

    return result;
  }

  private processEachBlocks(
    template: string,
    context: Record<string, unknown>,
  ): string {
    const eachRegex = /\{\{#each\s+([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    return template.replace(eachRegex, (_match, key: string, body: string) => {
      const items = this.resolve(key, context);
      if (!Array.isArray(items)) return '';

      return items
        .map((item, index) => {
          const itemContext: Record<string, unknown> = {
            ...context,
            '@index': index,
            '@first': index === 0,
            '@last': index === items.length - 1,
            this: item,
          };

          if (typeof item === 'object' && item !== null) {
            Object.assign(itemContext, item as Record<string, unknown>);
          }

          return this.compile(body, itemContext);
        })
        .join('');
    });
  }

  private processIfBlocks(
    template: string,
    context: Record<string, unknown>,
  ): string {
    const ifRegex = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;

    return template.replace(
      ifRegex,
      (_match, key: string, truthy: string, falsy: string = '') => {
        const value = this.resolve(key, context);
        return this.isTruthy(value)
          ? this.compile(truthy, context)
          : this.compile(falsy, context);
      },
    );
  }

  private processUnlessBlocks(
    template: string,
    context: Record<string, unknown>,
  ): string {
    const unlessRegex = /\{\{#unless\s+([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;

    return template.replace(unlessRegex, (_match, key: string, body: string) => {
      const value = this.resolve(key, context);
      return this.isTruthy(value) ? '' : this.compile(body, context);
    });
  }

  /**
   * Resolves a dotted path against a context object.
   */
  private resolve(path: string, context: Record<string, unknown>): unknown {
    const parts = path.split('.');
    let current: unknown = context;

    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private isTruthy(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
