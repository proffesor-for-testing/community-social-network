/**
 * Sanitizer Service Unit Tests - TDD London School
 * Tests for XSS prevention using DOMPurify patterns
 */

import { SanitizerService } from '../../../src/posts/sanitizer';

describe('SanitizerService', () => {
  let sanitizerService: SanitizerService;

  beforeEach(() => {
    sanitizerService = new SanitizerService();
  });

  describe('sanitize', () => {
    it('should pass through clean text unchanged', () => {
      // Arrange
      const cleanText = 'Hello, this is a normal post content!';

      // Act
      const result = sanitizerService.sanitize(cleanText);

      // Assert
      expect(result).toBe(cleanText);
    });

    it('should remove script tags', () => {
      // Arrange
      const maliciousContent = '<script>alert("xss")</script>Hello world!';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Hello world!');
    });

    it('should remove onclick handlers', () => {
      // Arrange
      const maliciousContent = '<div onclick="stealCookies()">Click me</div>';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('onclick');
      expect(result).not.toContain('stealCookies');
    });

    it('should remove onerror handlers', () => {
      // Arrange
      const maliciousContent = '<img src="x" onerror="alert(1)">';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('onerror');
      expect(result).not.toContain('alert');
    });

    it('should remove javascript: protocol in href', () => {
      // Arrange
      const maliciousContent = '<a href="javascript:alert(1)">Click me</a>';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('javascript:');
    });

    it('should remove data: URLs in src attributes', () => {
      // Arrange
      const maliciousContent = '<img src="data:text/html,<script>alert(1)</script>">';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('data:');
      expect(result).not.toContain('<script>');
    });

    it('should handle encoded XSS attempts', () => {
      // Arrange
      const encodedXss = '%3Cscript%3Ealert(1)%3C/script%3E';

      // Act
      const result = sanitizerService.sanitize(decodeURIComponent(encodedXss));

      // Assert
      expect(result).not.toContain('<script>');
    });

    it('should remove style tags with expressions', () => {
      // Arrange
      const maliciousContent = '<style>body{background:url("javascript:alert(1)")}</style>Content';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('<style>');
      expect(result).not.toContain('javascript:');
    });

    it('should remove iframe tags', () => {
      // Arrange
      const maliciousContent = '<iframe src="https://evil.com"></iframe>Hello';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('<iframe');
      expect(result).not.toContain('evil.com');
    });

    it('should remove object/embed tags', () => {
      // Arrange
      const maliciousContent = '<object data="malware.swf"></object><embed src="malware.swf">';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('<object');
      expect(result).not.toContain('<embed');
    });

    it('should remove form tags', () => {
      // Arrange
      const maliciousContent = '<form action="https://evil.com"><input name="password"></form>';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('<form');
      expect(result).not.toContain('evil.com');
    });

    it('should preserve allowed HTML tags', () => {
      // Arrange
      const htmlContent = '<b>Bold</b> and <i>italic</i> and <u>underline</u>';

      // Act
      const result = sanitizerService.sanitize(htmlContent);

      // Assert
      expect(result).toContain('<b>Bold</b>');
      expect(result).toContain('<i>italic</i>');
      expect(result).toContain('<u>underline</u>');
    });

    it('should preserve paragraph and line break tags', () => {
      // Arrange
      const htmlContent = '<p>Paragraph 1</p><p>Paragraph 2</p><br>Line break';

      // Act
      const result = sanitizerService.sanitize(htmlContent);

      // Assert
      expect(result).toContain('<p>');
      expect(result).toContain('</p>');
      expect(result).toContain('<br');
    });

    it('should preserve safe links', () => {
      // Arrange
      const htmlContent = '<a href="https://example.com">Safe link</a>';

      // Act
      const result = sanitizerService.sanitize(htmlContent);

      // Assert
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain('Safe link');
    });

    it('should add rel="noopener noreferrer" to links', () => {
      // Arrange
      const htmlContent = '<a href="https://example.com" target="_blank">External link</a>';

      // Act
      const result = sanitizerService.sanitize(htmlContent);

      // Assert
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it('should handle deeply nested malicious content', () => {
      // Arrange
      const maliciousContent = '<div><span><a href="javascript:alert(1)"><img onerror="alert(2)" src="x"></a></span></div>';

      // Act
      const result = sanitizerService.sanitize(maliciousContent);

      // Assert
      expect(result).not.toContain('javascript:');
      expect(result).not.toContain('onerror');
    });

    it('should handle SVG-based XSS', () => {
      // Arrange
      const svgXss = '<svg onload="alert(1)"><circle r="10"></circle></svg>';

      // Act
      const result = sanitizerService.sanitize(svgXss);

      // Assert
      expect(result).not.toContain('onload');
    });

    it('should handle mutation XSS', () => {
      // Arrange
      const mutationXss = '<noscript><p title="</noscript><script>alert(1)</script>">';

      // Act
      const result = sanitizerService.sanitize(mutationXss);

      // Assert
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should normalize unicode characters', () => {
      // Arrange
      const unicodeContent = 'Caf\u00e9 vs Cafe\u0301'; // Two ways to write cafe

      // Act
      const result = sanitizerService.sanitize(unicodeContent);

      // Assert
      // Both should normalize to the same form
      expect(result).toBe(result.normalize('NFC'));
    });
  });

  describe('stripAllHtml', () => {
    it('should remove all HTML tags', () => {
      // Arrange
      const htmlContent = '<p>Hello <b>world</b>!</p>';

      // Act
      const result = sanitizerService.stripAllHtml(htmlContent);

      // Assert
      expect(result).toBe('Hello world!');
    });

    it('should handle empty input', () => {
      // Act
      const result = sanitizerService.stripAllHtml('');

      // Assert
      expect(result).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      // Act & Assert
      expect(sanitizerService.stripAllHtml(null as unknown as string)).toBe('');
      expect(sanitizerService.stripAllHtml(undefined as unknown as string)).toBe('');
    });

    it('should convert HTML entities', () => {
      // Arrange
      const htmlContent = '&lt;script&gt;alert(1)&lt;/script&gt;';

      // Act
      const result = sanitizerService.stripAllHtml(htmlContent);

      // Assert
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('&lt;');
    });
  });

  describe('validateContentLength', () => {
    it('should return true for content within limit', () => {
      // Arrange
      const content = 'a'.repeat(1000);

      // Act
      const result = sanitizerService.validateContentLength(content, 10000);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for content exceeding limit', () => {
      // Arrange
      const content = 'a'.repeat(10001);

      // Act
      const result = sanitizerService.validateContentLength(content, 10000);

      // Assert
      expect(result).toBe(false);
    });

    it('should return true for empty content when checking length', () => {
      // Act
      const result = sanitizerService.validateContentLength('', 10000);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long content', () => {
      // Arrange
      const longContent = 'a'.repeat(100000);

      // Act
      const result = sanitizerService.sanitize(longContent);

      // Assert
      expect(result).toBe(longContent);
    });

    it('should handle content with only whitespace', () => {
      // Arrange
      const whitespaceContent = '   \n\t  \r\n  ';

      // Act
      const result = sanitizerService.sanitize(whitespaceContent);

      // Assert
      expect(result.trim()).toBe('');
    });

    it('should handle emoji content', () => {
      // Arrange
      const emojiContent = 'Hello! Check this out: some text here';

      // Act
      const result = sanitizerService.sanitize(emojiContent);

      // Assert
      expect(result).toBe(emojiContent);
    });

    it('should handle mixed language content', () => {
      // Arrange
      const mixedContent = 'Hello world! Bonjour! Some text';

      // Act
      const result = sanitizerService.sanitize(mixedContent);

      // Assert
      expect(result).toBe(mixedContent);
    });
  });
});
