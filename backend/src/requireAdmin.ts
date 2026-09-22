// 写操作鉴权中间件。
//
// 这份文件在四个站点项目里是完全相同的副本（由 capstone-admin/shared/ 同步过去）。
//
// 背景：这四个站的写接口和 /api/admin/* 原本完全没有鉴权，公网任何人都能调用，
// 包括 /api/admin/clear-all-data 这种清库接口。前端的「登录」只是往 localStorage
// 塞了个字符串，后端从不校验。
//
// 现在统一后台是唯一的管理入口，这些写接口不再需要给任何前端调用，
// 所以直接一律要求 Bearer token，token 用和统一后台同一个 JWT_SECRET 签发。

import type { Context, Next } from 'hono';

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface AdminEnv {
  JWT_SECRET?: string;
}

function unb64url(s: string): Uint8Array {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verify(secret: string, token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      unb64url(parts[2]),
      enc.encode(`${parts[0]}.${parts[1]}`)
    );
    if (!ok) return false;
    const payload = JSON.parse(dec.decode(unb64url(parts[1]))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

/**
 * 这些接口虽然是 GET，但会改数据，必须一并保护。
 * 原作者把「修复 URL」「重建缓存」这类操作都写成了 GET。
 */
const MUTATING_GETS = new Set([
  '/api/fix-poster-urls',
  '/api/force-fix-urls',
  '/api/fix-specific-poster',
  '/api/complete-fix-all',
  '/api/build-search-indexes',
  '/api/build-version-search-indexes',
  '/api/refactor-database',
  '/api/export-categorized-data',
]);

function needsAuth(method: string, path: string): boolean {
  // /api/admin/* 一律保护，不管什么方法
  if (path.startsWith('/api/admin/')) return true;
  if (MUTATING_GETS.has(path)) return true;
  // 其余 /api 下的非读方法一律保护
  if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  return false;
}

/**
 * 全局中间件：放在所有路由之前 app.use('*', requireAdmin)。
 *
 * 公开的 GET 读接口不受影响；写操作和 /api/admin/* 需要统一后台签发的 token。
 *
 * 没配 JWT_SECRET 时对需要鉴权的请求一律拒绝（fail closed）—— 宁可管理操作报错，
 * 也不要因为漏配密钥而把清库接口重新暴露到公网。
 */
export async function requireAdmin(c: Context, next: Next) {
  const path = new URL(c.req.url).pathname;
  if (!needsAuth(c.req.method, path)) return next();

  const env = (c.env as unknown) as AdminEnv;
  if (!env.JWT_SECRET) {
    return c.json({ error: '服务端未配置 JWT_SECRET，管理接口已停用' }, 503);
  }
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || !(await verify(env.JWT_SECRET, token))) {
    return c.json({ error: '未授权：请从统一管理后台操作' }, 401);
  }
  await next();
}
