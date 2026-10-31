import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import { decodeText, InvalidTextFileError } from '../src/main/library/text';

describe('decodeText', () => {
  it('decodes UTF-8 with a BOM', () => {
    expect(decodeText(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('第一章')]))).toBe('第一章');
  });

  it('falls back to GB18030', () => {
    expect(decodeText(iconv.encode('山川与河流', 'gb18030'))).toBe('山川与河流');
  });

  it('rejects binary input', () => {
    expect(() => decodeText(Buffer.from([0, 1, 2, 3]))).toThrow(InvalidTextFileError);
  });
});
