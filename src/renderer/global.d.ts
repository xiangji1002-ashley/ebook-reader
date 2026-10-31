import type { DesktopApi } from '../shared/models';

declare global { interface Window { desktopApi: DesktopApi } }
export {};
