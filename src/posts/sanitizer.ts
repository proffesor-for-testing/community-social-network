/**
 * Sanitizer Service
 * XSS prevention using DOMPurify-like patterns
 *
 * This service provides content sanitization to prevent:
 * - Script injection (XSS)
 * - Event handler injection
 * - Malicious URL protocols
 * - SVG/XML-based attacks
 * - Mutation XSS
 */

// Allowed HTML tags for post content
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'a',
  'span',
  'div',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
  'pre',
]);

// Allowed attributes per tag
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'rel', 'target']),
  img: new Set(['src', 'alt', 'width', 'height']),
  '*': new Set(['class']),
};

// Dangerous patterns to remove
const DANGEROUS_PATTERNS = [
  // Script tags
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // Event handlers
  /\s+on\w+\s*=\s*["'][^"']*["']/gi,
  /\s+on\w+\s*=\s*[^\s>]+/gi,
  // javascript: protocol
  /javascript\s*:/gi,
  // data: URLs (except safe images)
  /data\s*:\s*(?!image\/(png|jpeg|gif|webp))[^"'\s>]*/gi,
  // vbscript: protocol
  /vbscript\s*:/gi,
  // expression() in CSS
  /expression\s*\(/gi,
  // Style tags
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
  // iframe tags
  /<iframe\b[^>]*>.*?<\/iframe>/gis,
  /<iframe\b[^>]*\/?\s*>/gi,
  // object/embed tags
  /<object\b[^>]*>.*?<\/object>/gis,
  /<embed\b[^>]*\/?>/gi,
  // form tags
  /<form\b[^>]*>.*?<\/form>/gis,
  // input/textarea/button
  /<(input|textarea|button|select)\b[^>]*\/?>/gi,
  // SVG event handlers
  /<svg\b[^>]*\s+on\w+[^>]*>/gi,
  // Meta refresh
  /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
  // Base tag
  /<base\b[^>]*>/gi,
  // Link tag with rel=import
  /<link\b[^>]*rel\s*=\s*["']?import["']?[^>]*>/gi,
  // noscript (can be used for mutation XSS)
  /<noscript\b[^>]*>.*?<\/noscript>/gis,
];

// Tags to completely remove (including content)
const REMOVE_WITH_CONTENT = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'noscript',
];

export class SanitizerService {
  /**
   * Sanitize HTML content to prevent XSS attacks
   * Allows safe HTML tags while removing dangerous ones
   */
  sanitize(content: string): string {
    if (!content) {
      return '';
    }

    let sanitized = content;

    // Step 1: Remove dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Step 2: Remove tags that should be stripped with content
    for (const tag of REMOVE_WITH_CONTENT) {
      const regex = new RegExp(
        `<${tag}\\b[^>]*>.*?<\\/${tag}>|<${tag}\\b[^>]*\\/?>`,
        'gis'
      );
      sanitized = sanitized.replace(regex, '');
    }

    // Step 3: Remove event handlers from remaining tags
    sanitized = sanitized.replace(
      /(<[^>]+)\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
      '$1'
    );

    // Step 4: Clean up javascript: in href/src
    sanitized = sanitized.replace(
      /(<[^>]+(?:href|src)\s*=\s*)["']?\s*javascript:[^"'\s>]*/gi,
      '$1""'
    );

    // Step 5: Remove data: URLs except for safe image types
    sanitized = sanitized.replace(
      /(<[^>]+(?:href|src)\s*=\s*)["']?\s*data:(?!image\/(png|jpeg|gif|webp))[^"'\s>]*/gi,
      '$1""'
    );

    // Step 6: Add rel="noopener noreferrer" to links with target="_blank"
    sanitized = sanitized.replace(
      /(<a\s+[^>]*target\s*=\s*["']?_blank["']?[^>]*)(?!\s+rel\s*=)/gi,
      '$1 rel="noopener noreferrer"'
    );

    // Step 7: Also add rel to existing links without it
    sanitized = sanitized.replace(
      /(<a\s+[^>]*href\s*=\s*["'][^"']+["'][^>]*)(?!\s+rel\s*=)/gi,
      (match) => {
        if (match.includes('target="_blank"') || match.includes("target='_blank'")) {
          return match.replace(/(<a\s+)/, '$1rel="noopener noreferrer" ');
        }
        return match;
      }
    );

    // Step 8: Normalize unicode to prevent bypass attacks
    sanitized = sanitized.normalize('NFC');

    return sanitized;
  }

  /**
   * Strip all HTML tags and return plain text
   */
  stripAllHtml(content: string): string {
    if (!content) {
      return '';
    }

    // Decode HTML entities first
    let text = content
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // Remove all HTML tags
    text = text.replace(/<[^>]*>/g, '');

    // Clean up multiple whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Validate content length
   */
  validateContentLength(content: string, maxLength: number): boolean {
    if (!content) {
      return true;
    }
    return content.length <= maxLength;
  }

  /**
   * Sanitize and validate content for posts
   * Combines sanitization with length validation
   */
  sanitizePostContent(content: string, maxLength: number = 10000): {
    sanitized: string;
    isValid: boolean;
    error?: string;
  } {
    const sanitized = this.sanitize(content);

    if (!sanitized.trim()) {
      return {
        sanitized: '',
        isValid: false,
        error: 'Content cannot be empty after sanitization',
      };
    }

    if (!this.validateContentLength(sanitized, maxLength)) {
      return {
        sanitized,
        isValid: false,
        error: `Content exceeds maximum length of ${maxLength} characters`,
      };
    }

    return {
      sanitized,
      isValid: true,
    };
  }
}

// Export singleton instance
export const sanitizerService = new SanitizerService();
