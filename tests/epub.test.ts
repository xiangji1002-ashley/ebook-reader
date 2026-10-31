import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { InvalidEpubError, validateEpub } from '../src/main/library/epub';

async function makeEpub(options: { title?: string; container?: boolean; unsafe?: boolean } = {}) {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  if (options.container !== false) zip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
  zip.file('OEBPS/content.opf', `<package><metadata><dc:title>${options.title ?? '测试书'}</dc:title></metadata><manifest></manifest><spine></spine></package>`);
  if (options.unsafe) zip.file('../outside.xhtml', '<p>bad</p>');
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

describe('validateEpub', () => {
  it('validates structure and extracts title', async () => {
    await expect(validateEpub(await makeEpub({ title: '远方' }))).resolves.toEqual({ title: '远方' });
  });

  it('rejects missing container metadata', async () => {
    await expect(validateEpub(await makeEpub({ container: false }))).rejects.toBeInstanceOf(InvalidEpubError);
  });

  it('rejects non-zip input', async () => {
    await expect(validateEpub(Buffer.from('not a zip'))).rejects.toThrow('ZIP 签名缺失');
  });

  it('rejects path traversal entries', async () => {
    await expect(validateEpub(await makeEpub({ unsafe: true }))).rejects.toThrow('不安全的路径');
  });
});
