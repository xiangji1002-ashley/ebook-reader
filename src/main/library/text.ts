import iconv from 'iconv-lite';

export class InvalidTextFileError extends Error {}

export function decodeText(buffer: Buffer): string {
  const sample = buffer.subarray(0, Math.min(buffer.length, 64 * 1024));
  if (sample.includes(0)) throw new InvalidTextFileError('该文件包含二进制内容，不是有效的 TXT 文档。');
  const controlCount = [...sample].filter((byte) => byte < 9 || (byte > 13 && byte < 32)).length;
  if (sample.length > 0 && controlCount / sample.length > 0.02) throw new InvalidTextFileError('该文件包含过多不可打印字符。');

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.subarray(3).toString('utf8');
  const utf8 = buffer.toString('utf8');
  const replacements = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacements === 0 || replacements / Math.max(utf8.length, 1) < 0.001) return utf8;
  const gb = iconv.decode(buffer, 'gb18030');
  if (!gb.includes('\uFFFD')) return gb;
  throw new InvalidTextFileError('无法识别文本编码，请使用 UTF-8 或 GB18030 编码。');
}
