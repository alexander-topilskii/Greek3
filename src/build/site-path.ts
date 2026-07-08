import { encodeSitePath } from './urls';

export const SITE_BASE_URL = process.env.SITE_BASE_URL ?? '';
export const ASSET_VERSION = process.env.BUILD_ID ?? '2';

export function sitePath(relativePath: string): string {
  return encodeSitePath(SITE_BASE_URL, relativePath);
}
