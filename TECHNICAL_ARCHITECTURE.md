# 电子书阅读器 MVP 技术架构

## 1. 文档信息

- 产品：E-Book Reader（暂定）
- 产品形态：桌面应用
- 阶段：V1.0 MVP
- 架构结论：Electron + React + TypeScript + SQLite + 本地图书文件存储

## 2. 架构目标

本架构服务于以下 MVP 核心流程：

> 导入 TXT/EPUB → 加入书架 → 打开阅读 → 自动保存进度 → 下次继续阅读

设计目标：

- 完全离线运行，MVP 不依赖后端服务。
- 导入后的图书由应用托管，不依赖原始文件持续存在。
- 稳定支持 TXT 和常规 EPUB 的纵向滚动阅读。
- 在应用重启后保留书架和每本书最近一次阅读位置。
- 严格隔离不可信 EPUB 内容与本机文件系统权限。
- 通过阅读器适配层隔离格式差异及第三方 EPUB 引擎。
- 为后续增加书签、目录、搜索和云同步保留扩展边界。

## 3. 技术选型

| 领域 | 选型 | 用途 |
|---|---|---|
| 桌面容器 | Electron | 跨平台桌面运行环境和系统能力 |
| 开发语言 | TypeScript | 主进程、Preload 和渲染进程共享类型 |
| 用户界面 | React | 书架与阅读器页面 |
| 前端构建 | Vite | 开发服务器与 Renderer 构建 |
| 应用打包 | Electron Forge | 安装包、签名及发布流程 |
| 元数据存储 | SQLite | 图书元数据与阅读进度 |
| 图书文件存储 | 本地文件系统 | 保存应用托管的 TXT/EPUB 原始文件 |
| EPUB 阅读 | epub.js（适配器封装） | EPUB 解析、渲染与 CFI 定位 |
| TXT 阅读 | 自研适配器 | 编码处理、分段渲染与字符定位 |
| 数据校验 | Zod 或同类 Schema 工具 | IPC 输入输出和领域对象校验 |
| 单元测试 | Vitest | 领域逻辑、数据访问和工具函数测试 |
| 组件测试 | React Testing Library | 页面和组件行为测试 |
| 端到端测试 | Playwright | 打包前的完整桌面流程验证 |

MVP 不引入后端、账号系统、云存储或前后端同步机制。

## 4. 总体架构

```text
┌──────────────────────────────────────────┐
│ Renderer Process                         │
│ React + TypeScript                       │
│                                          │
│ LibraryPage ───── ReaderPage             │
│                      │                   │
│              ReaderAdapter               │
│              ├── TxtReaderAdapter        │
│              └── EpubReaderAdapter       │
└───────────────────┬──────────────────────┘
                    │ Typed IPC
┌───────────────────▼──────────────────────┐
│ Preload                                  │
│ contextBridge                            │
│ 只暴露有限、类型明确的业务 API             │
└───────────────────┬──────────────────────┘
                    │
┌───────────────────▼──────────────────────┐
│ Main Process                             │
│                                          │
│ LibraryService                           │
│ ProgressService                          │
│ BookFileRepository ─── 本地图书目录        │
│ MetadataRepository ─── SQLite            │
│ Import Worker ─────── 文件解析/哈希/校验   │
└──────────────────────────────────────────┘
```

### 4.1 进程职责

#### Main Process

- 管理应用和窗口生命周期。
- 打开系统文件选择对话框。
- 读写本地文件和 SQLite。
- 执行导入、删除、恢复和数据迁移。
- 校验所有来自 Renderer 的 IPC 参数。
- 阻止未授权导航、新窗口和外部资源访问。

#### Preload

- 使用 `contextBridge` 暴露受限的业务 API。
- 将底层 IPC channel 隐藏在明确的方法之后。
- 不暴露 `fs`、`shell`、数据库连接或原始 `ipcRenderer`。

#### Renderer Process

- 渲染书架页面和阅读页面。
- 管理视图状态、加载状态与用户交互。
- 通过 Reader Adapter 渲染 TXT 或 EPUB。
- 只能通过 Preload API 请求本地能力。

#### Worker / Utility Process

- 计算文件 SHA-256。
- 校验 EPUB ZIP 结构。
- 解析 EPUB 元数据。
- 处理可能阻塞 Main Process 的大文件任务。

## 5. 模块设计

### 5.1 Library 模块

负责：

- 选择并导入 TXT/EPUB。
- 文件格式、大小和完整性校验。
- 重复文件检测。
- 提取并保存图书元数据。
- 查询书架列表。
- 删除图书、缓存及关联进度。

### 5.2 Reader 模块

页面仅依赖统一接口：

```ts
interface ReaderAdapter {
  open(source: BookSource): Promise<BookMetadata>;
  mount(container: HTMLElement): Promise<void>;
  restore(locator: ReadingLocator): Promise<void>;
  getCurrentLocator(): ReadingLocator | null;
  subscribeLocationChange(
    listener: (locator: ReadingLocator) => void,
  ): () => void;
  destroy(): Promise<void>;
}
```

实现包括：

- `TxtReaderAdapter`：解码、分段渲染、字符偏移定位。
- `EpubReaderAdapter`：封装 epub.js，不允许 epub.js 类型扩散到页面层。

### 5.3 Reading Progress 模块

- 每本书只保存一条最新进度。
- 滚动时更新内存状态。
- 停止滚动 500–1000ms 后防抖写入。
- 返回书架、窗口失焦和退出前立即补存。
- 写入失败时保留内存状态并提供重试。

## 6. 本地存储

### 6.1 目录结构

应用通过 `app.getPath("userData")` 获取数据根目录，并在其下创建独立子目录：

```text
<ApplicationData>/EBookReader/
├── data/
│   └── library.sqlite
├── books/
│   ├── <book-id>.epub
│   └── <book-id>.txt
├── cache/
│   ├── covers/
│   └── extracted/
├── temp/
└── logs/
```

导入时复制文件到 `books`，而不是只记录用户原文件路径。这样即使原文件被移动、重命名或删除，书架仍然可用。

MVP 应设置单本书大小上限，并监控应用数据目录总量。

### 6.2 SQLite Schema

```sql
CREATE TABLE books (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  format          TEXT NOT NULL CHECK (format IN ('txt', 'epub')),
  original_name   TEXT NOT NULL,
  stored_name     TEXT NOT NULL,
  file_hash       TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  import_status   TEXT NOT NULL DEFAULT 'ready',
  imported_at     INTEGER NOT NULL,
  last_opened_at  INTEGER
);

CREATE UNIQUE INDEX books_file_hash_idx ON books(file_hash);

CREATE TABLE reading_progress (
  book_id         TEXT PRIMARY KEY,
  locator_type    TEXT NOT NULL,
  locator         TEXT NOT NULL,
  percentage      REAL,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
);
```

SQLite 只保存元数据和进度，不保存完整图书二进制内容。数据库必须启用版本号和 migration 机制。

## 7. 文件导入流程

```text
选择文件
  ↓
检查扩展名和文件大小
  ↓
检查真实文件结构
  ↓
计算 SHA-256
  ↓
检查重复文件
  ↓
解析标题等元数据
  ↓
复制到临时目录
  ↓
写入数据库
  ↓
原子移动到 books 目录
  ↓
书架刷新
```

导入状态使用 `importing`、`ready`、`failed`。应用启动时清理遗留临时文件，并修复未完成的导入记录。

### 7.1 TXT 校验

- 不只依赖扩展名或 MIME。
- 排除包含大量不可打印字节的明显二进制文件。
- 优先识别 UTF-8 和 BOM。
- 中文使用场景兼容 GB18030。
- 无法可靠识别时返回明确错误。
- 大文件分块读取和渲染，避免一次创建大量 DOM 节点。

### 7.2 EPUB 校验

- 检查 ZIP 文件签名。
- 检查 `mimetype` 和 `META-INF/container.xml`。
- 检查 OPF、manifest 和 spine。
- 限制压缩文件大小、解压总大小、条目数量和压缩比。
- 拒绝包含路径穿越条目的压缩包。
- 优先从 OPF 提取书名，失败时使用文件名。

## 8. 阅读位置

### 8.1 TXT Locator

```ts
interface TxtLocator {
  type: "text-offset";
  offset: number;
  context?: string;
  percentage: number;
}
```

以字符偏移为主要定位依据，文本上下文和百分比作为恢复兜底。不要将 `scrollTop` 作为唯一进度，因为窗口尺寸和排版变化会使其失效。

### 8.2 EPUB Locator

```ts
interface EpubLocator {
  type: "epub-cfi";
  cfi: string;
  spineHref?: string;
  percentage?: number;
}
```

以 EPUB CFI 为主要位置，spine 地址和百分比作为兜底。

## 9. IPC Contract

Preload 暴露业务级 API：

```ts
interface DesktopApi {
  library: {
    selectAndImport(): Promise<ImportResult>;
    list(): Promise<BookSummary[]>;
    delete(bookId: string): Promise<void>;
    getSource(bookId: string): Promise<BookSource>;
  };

  progress: {
    get(bookId: string): Promise<ReadingLocator | null>;
    save(bookId: string, locator: ReadingLocator): Promise<void>;
  };
}
```

规则：

- Renderer 只提交 `bookId`，不提交任意文件路径。
- Main 根据 `bookId` 查找真实路径。
- Main 对所有参数执行 Schema 校验。
- 返回值只能是可序列化 DTO。
- 不提供任意 channel 调用能力。
- 不允许 Renderer 直接访问 SQLite 或文件系统。

## 10. 安全设计

BrowserWindow 基础配置：

```ts
new BrowserWindow({
  webPreferences: {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
  },
});
```

必须同时满足：

- 使用严格 CSP，默认只允许应用自身资源。
- 拒绝未授权导航和新窗口。
- 外部链接经过协议和域名白名单校验。
- EPUB 内容使用沙箱 iframe 渲染。
- 保持 epub.js 的 scripted content 禁用。
- 不加载或执行远程应用代码。
- 不关闭证书校验或 `webSecurity`。
- 对 IPC 调用执行身份、参数和资源范围校验。
- 日志不记录书籍正文或其他敏感内容。

## 11. 项目结构

```text
ebook-reader/
├── src/
│   ├── main/
│   │   ├── app.ts
│   │   ├── window.ts
│   │   ├── ipc/
│   │   ├── library/
│   │   ├── progress/
│   │   ├── storage/
│   │   └── workers/
│   ├── preload/
│   │   ├── index.ts
│   │   └── desktop-api.ts
│   ├── renderer/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── readers/
│   │   ├── hooks/
│   │   └── state/
│   └── shared/
│       ├── contracts/
│       ├── schemas/
│       └── models/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── security/
│   ├── e2e/
│   └── fixtures/
├── migrations/
└── forge.config.ts
```

`shared` 只能包含纯 TypeScript 类型、Schema 和领域模型，不得依赖 Electron、Node 文件系统或 React。

## 12. 测试与验收

### 12.1 单元测试

- TXT 编码和二进制检测。
- EPUB 结构校验。
- 文件哈希和重复检测。
- Locator 序列化与恢复。
- 进度防抖。
- Repository 和 migration。
- IPC Schema 校验。

### 12.2 集成测试

- 导入成功后文件与数据库记录一致。
- 导入失败不留下不可用记录。
- 删除同时清理文件、缓存和进度。
- 应用重启后书架与进度仍然存在。
- 文件缺失时返回可理解的错误。
- 数据库升级后旧数据仍可读取。

### 12.3 安全测试

- 包含脚本的 EPUB 不执行脚本。
- 拒绝路径穿越 EPUB。
- 拒绝超出限制的压缩包。
- 拒绝恶意导航和外部链接。
- 拒绝非法 IPC 参数。
- Renderer 无法直接访问 Node.js 和文件系统。

### 12.4 端到端测试

```text
启动应用
→ 导入图书
→ 在书架中打开
→ 滚动阅读
→ 返回书架
→ 再次打开并恢复位置
→ 重启应用并再次恢复
→ 删除图书
```

TXT 和 EPUB 均需执行完整流程。发布前还需针对打包后的安装产物执行 smoke test。

测试夹具至少包括：

- UTF-8、带 BOM 和 GB18030 TXT。
- 常规、多章节、带图片和长章节 EPUB。
- 损坏 ZIP、缺少 container.xml、包含脚本和路径穿越的 EPUB。
- 超过大小限制的文件。

## 13. 实施阶段

1. 建立 Electron 安全骨架、React 页面、SQLite migration 和测试基础设施。
2. 完成 TXT 导入、书架、阅读和进度恢复闭环。
3. 完成 EPUB 技术验证，重点验证长章节纵向滚动和 CFI 恢复。
4. 完成异常恢复、删除、恶意文件校验和安全加固。
5. 完成安装包、代码签名、打包产物测试和发布流程。

EPUB 技术验证是正式开发前的关键检查点。如果 epub.js 的连续滚动质量不能达到验收要求，只替换 `EpubReaderAdapter`，不改变页面、存储和进度服务。

## 14. 暂不纳入 MVP

- 用户账号和云同步。
- 多设备阅读进度同步。
- 多书签、批注和高亮。
- 全文搜索。
- 分类、标签和批量操作。
- 仿真翻页和复杂排版设置。
- 在线书城、下载和 DRM。
- 自动扫描用户目录。

## 15. 参考资料

- [Electron Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron Application Packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution)
- [epub.js README](https://github.com/futurepress/epub.js/blob/master/README.md)
