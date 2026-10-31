import JSZip from 'jszip';

const MAX_ENTRIES = 2_000;
const MAX_UNCOMPRESSED = 500 * 1024 * 1024;

export class InvalidEpubError extends Error {}

export async function validateEpub(buffer: Buffer): Promise<{ title?: string }> {
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new InvalidEpubError('文件不是有效的 EPUB（ZIP 签名缺失）。');
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buffer, { checkCRC32: true }); }
  catch { throw new InvalidEpubError('EPUB 压缩包已损坏。'); }

  const names = Object.keys(zip.files);
  if (names.length > MAX_ENTRIES) throw new InvalidEpubError('EPUB 包含过多文件。');
  if (Object.values(zip.files).some((entry) => {
    const original = (entry as unknown as { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    return original.startsWith('/') || original.split('/').includes('..');
  })) throw new InvalidEpubError('EPUB 包含不安全的路径。');

  let expanded = 0;
  for (const entry of Object.values(zip.files)) {
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    expanded += size;
  }
  if (expanded > MAX_UNCOMPRESSED || expanded > Math.max(buffer.length * 200, 10 * 1024 * 1024)) throw new InvalidEpubError('EPUB 解压后体积异常。');

  const mimetype = zip.file('mimetype');
  const container = zip.file('META-INF/container.xml');
  if (!mimetype || !container || (await mimetype.async('string')).trim() !== 'application/epub+zip') throw new InvalidEpubError('EPUB 缺少必要的 mimetype 或 container.xml。');
  const containerXml = await container.async('string');
  const rootMatch = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i);
  if (!rootMatch) throw new InvalidEpubError('EPUB container.xml 未指定内容包。');
  const opf = zip.file(rootMatch[1]);
  if (!opf) throw new InvalidEpubError('EPUB 内容包不存在。');
  const opfXml = await opf.async('string');
  if (!/<manifest[\s>]/i.test(opfXml) || !/<spine[\s>]/i.test(opfXml)) throw new InvalidEpubError('EPUB 缺少 manifest 或 spine。');
  const title = opfXml.match(/<(?:dc:)?title(?:\s[^>]*)?>([^<]+)<\//i)?.[1]?.trim();
  return { title };
}
