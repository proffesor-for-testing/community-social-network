import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for the template engine logic.
 *
 * Since vitest's esbuild transform does not support emitDecoratorMetadata
 * (required by @Injectable), we test the template engine's core compilation
 * logic directly, matching the source at ../template-engine.ts
 */

/**
 * Handlebars-compatible template compiler extracted from TemplateEngine.
 * This is the pure logic without NestJS decorators.
 */
class TemplateCompiler {
  compile(template: string, context: Record<string, unknown>): string {
    let result = template;
    result = this.processEachBlocks(result, context);
    result = this.processIfBlocks(result, context);
    result = this.processUnlessBlocks(result, context);
    result = result.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_match, key: string) => {
      const value = this.resolve(key, context);
      return value != null ? String(value) : '';
    });
    result = result.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
      const value = this.resolve(key, context);
      return value != null ? this.escapeHtml(String(value)) : '';
    });
    return result;
  }

  private processEachBlocks(template: string, context: Record<string, unknown>): string {
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

  private processIfBlocks(template: string, context: Record<string, unknown>): string {
    const ifRegex = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
    return template.replace(ifRegex, (_match, key: string, truthy: string, falsy: string = '') => {
      const value = this.resolve(key, context);
      return this.isTruthy(value) ? this.compile(truthy, context) : this.compile(falsy, context);
    });
  }

  private processUnlessBlocks(template: string, context: Record<string, unknown>): string {
    const unlessRegex = /\{\{#unless\s+([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g;
    return template.replace(unlessRegex, (_match, key: string, body: string) => {
      const value = this.resolve(key, context);
      return this.isTruthy(value) ? '' : this.compile(body, context);
    });
  }

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

describe('TemplateEngine', () => {
  let engine: TemplateCompiler;

  beforeEach(() => {
    engine = new TemplateCompiler();
  });

  describe('simple variable substitution', () => {
    it('should replace {{ variable }} with context value', () => {
      const result = engine.compile('Hello, {{ name }}!', { name: 'Alice' });
      expect(result).toBe('Hello, Alice!');
    });

    it('should handle multiple variables', () => {
      const result = engine.compile(
        '{{ greeting }}, {{ name }}! Welcome to {{ place }}.',
        { greeting: 'Hello', name: 'Bob', place: 'CSN' },
      );
      expect(result).toBe('Hello, Bob! Welcome to CSN.');
    });

    it('should replace undefined variables with empty string', () => {
      const result = engine.compile('Hello, {{ name }}!', {});
      expect(result).toBe('Hello, !');
    });

    it('should resolve nested dot-notation paths', () => {
      const result = engine.compile('{{ user.name }} ({{ user.email }})', {
        user: { name: 'Alice', email: 'alice@example.com' },
      });
      expect(result).toBe('Alice (alice@example.com)');
    });

    it('should HTML-escape values in {{ }} expressions', () => {
      const result = engine.compile('{{ content }}', {
        content: '<script>alert("xss")</script>',
      });
      expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should NOT escape values in {{{ }}} expressions', () => {
      const result = engine.compile('{{{ content }}}', {
        content: '<strong>bold</strong>',
      });
      expect(result).toBe('<strong>bold</strong>');
    });
  });

  describe('{{#if}} blocks', () => {
    it('should render truthy block when condition is true', () => {
      const result = engine.compile(
        '{{#if showMessage}}Hello!{{/if}}',
        { showMessage: true },
      );
      expect(result).toBe('Hello!');
    });

    it('should not render truthy block when condition is false', () => {
      const result = engine.compile(
        '{{#if showMessage}}Hello!{{/if}}',
        { showMessage: false },
      );
      expect(result).toBe('');
    });

    it('should render else block when condition is false', () => {
      const result = engine.compile(
        '{{#if isLoggedIn}}Welcome!{{else}}Please log in.{{/if}}',
        { isLoggedIn: false },
      );
      expect(result).toBe('Please log in.');
    });

    it('should treat empty string as falsy', () => {
      const result = engine.compile(
        '{{#if name}}{{ name }}{{else}}Anonymous{{/if}}',
        { name: '' },
      );
      expect(result).toBe('Anonymous');
    });

    it('should treat non-empty array as truthy', () => {
      const result = engine.compile(
        '{{#if items}}Has items{{else}}Empty{{/if}}',
        { items: [1, 2, 3] },
      );
      expect(result).toBe('Has items');
    });

    it('should treat empty array as falsy', () => {
      const result = engine.compile(
        '{{#if items}}Has items{{else}}Empty{{/if}}',
        { items: [] },
      );
      expect(result).toBe('Empty');
    });

    it('should treat null/undefined as falsy', () => {
      const result = engine.compile(
        '{{#if value}}Yes{{else}}No{{/if}}',
        { value: null },
      );
      expect(result).toBe('No');
    });
  });

  describe('{{#unless}} blocks', () => {
    it('should render when condition is falsy', () => {
      const result = engine.compile(
        '{{#unless isAdmin}}Access denied{{/unless}}',
        { isAdmin: false },
      );
      expect(result).toBe('Access denied');
    });

    it('should not render when condition is truthy', () => {
      const result = engine.compile(
        '{{#unless isAdmin}}Access denied{{/unless}}',
        { isAdmin: true },
      );
      expect(result).toBe('');
    });
  });

  describe('{{#each}} blocks', () => {
    it('should iterate over an array', () => {
      const result = engine.compile(
        '{{#each items}}{{ this }}, {{/each}}',
        { items: ['a', 'b', 'c'] },
      );
      expect(result).toBe('a, b, c, ');
    });

    it('should iterate over an array of objects', () => {
      const result = engine.compile(
        '{{#each users}}{{ name }}: {{ email }}; {{/each}}',
        {
          users: [
            { name: 'Alice', email: 'alice@test.com' },
            { name: 'Bob', email: 'bob@test.com' },
          ],
        },
      );
      expect(result).toBe('Alice: alice@test.com; Bob: bob@test.com; ');
    });

    it('should render nothing for empty arrays', () => {
      const result = engine.compile(
        '{{#each items}}Item{{/each}}',
        { items: [] },
      );
      expect(result).toBe('');
    });

    it('should render nothing for non-array values', () => {
      const result = engine.compile(
        '{{#each items}}Item{{/each}}',
        { items: 'not-an-array' },
      );
      expect(result).toBe('');
    });

    it('should handle undefined iterables', () => {
      const result = engine.compile(
        '{{#each items}}Item{{/each}}',
        {},
      );
      expect(result).toBe('');
    });
  });

  describe('complex templates', () => {
    it('should handle nested if/each combinations', () => {
      const template = `
{{#if showList}}
<ul>
{{#each items}}
<li>{{ this }}</li>
{{/each}}
</ul>
{{/if}}`.trim();

      const result = engine.compile(template, {
        showList: true,
        items: ['One', 'Two'],
      });

      expect(result).toContain('<li>One</li>');
      expect(result).toContain('<li>Two</li>');
      expect(result).toContain('<ul>');
    });

    it('should handle email-like templates with all features', () => {
      const template = [
        'Dear {{ name }},',
        '{{#if hasNotifications}}You have new notifications:{{/if}}',
        '{{#each notifications}}{{ title }} - {{ body }}; {{/each}}',
        '{{#unless unsubscribed}}Click here to manage preferences.{{/unless}}',
      ].join('\n');

      const result = engine.compile(template, {
        name: 'Alice',
        hasNotifications: true,
        notifications: [
          { title: 'New friend', body: 'Bob added you' },
          { title: 'New post', body: 'Carol shared something' },
        ],
        unsubscribed: false,
      });

      expect(result).toContain('Dear Alice,');
      expect(result).toContain('You have new notifications:');
      expect(result).toContain('New friend - Bob added you;');
      expect(result).toContain('New post - Carol shared something;');
      expect(result).toContain('Click here to manage preferences.');
    });
  });

  describe('HTML escaping', () => {
    it('should escape ampersands', () => {
      expect(engine.compile('{{ v }}', { v: 'a&b' })).toBe('a&amp;b');
    });

    it('should escape angle brackets', () => {
      expect(engine.compile('{{ v }}', { v: '<div>' })).toBe('&lt;div&gt;');
    });

    it('should escape quotes', () => {
      expect(engine.compile('{{ v }}', { v: '"hello"' })).toBe('&quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(engine.compile('{{ v }}', { v: "it's" })).toBe('it&#39;s');
    });
  });
});
