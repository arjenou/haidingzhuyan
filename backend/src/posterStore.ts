// 海报读取层：从统一后台的 D1「capstone」库读，取代原来的 KV 索引 + 导出缓存。
//
// 这份文件在四个站点项目里是完全相同的副本（由 capstone-admin/shared/ 同步过去），
// 改动请改 capstone-admin/shared/posterStore.ts 后重新分发。
//
// 迁移策略：这些路由注册在原 KV 路由之前，Hono 首个匹配的生效。
// 要回退，把 index.ts 里 registerPosterReadRoutes(...) 那一行注释掉即可，
// 原 KV 代码路径还在。
//
// 响应结构逐字对齐原实现，前端不需要改：
//   - 排序 updated_at DESC, id DESC（原来是内存里 sort((a,b)=>b.updatedAt-a.updatedAt)）
//   - 每页 5 条
//   - imageUrl 由请求 origin + image_key 拼出，不再存绝对 URL

import type { Hono } from 'hono';

export interface PosterEnv {
  DB: D1Database;
}

export const POSTERS_PER_PAGE = 5;

export const CATEGORY_MAPPING: Record<string, string> = {
  工科: 'gongke',
  文科: 'wenke',
  商科: 'shangke',
  理科: 'like',
};

const KEY_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MAPPING).map(([cn, key]) => [key, cn])
);

interface Row {
  id: string;
  title: string;
  description: string;
  category: string;
  target_audience: string;
  image_key: string | null;
  version: string | null;
  created_at: number;
  updated_at: number;
}

/** 接受中文分类名或 gongke 这类 key，统一返回中文分类名 */
function toCategoryName(input: string): string {
  if (KEY_TO_CATEGORY[input]) return KEY_TO_CATEGORY[input];
  return input;
}

function parseAudience(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function shape(r: Row, origin: string) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    targetAudience: parseAudience(r.target_audience),
    imageKey: r.image_key ?? '',
    imageUrl: r.image_key
      ? `${origin}/api/get-poster-url/${encodeURIComponent(r.image_key)}`
      : '',
    ...(r.version ? { version: r.version } : {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const ORDER = 'ORDER BY updated_at DESC, id DESC';

function likeArg(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
}

/**
 * @param app  站点的 Hono 实例
 * @param site 该站点在 D1 里的 site 值
 */
export function registerPosterReadRoutes(app: Hono, site: string): void {
  const originOf = (c: { req: { url: string } }) => new URL(c.req.url).origin;

  const build = (extra: string[] = [], extraArgs: unknown[] = []) => ({
    where: ['site = ?', ...extra].join(' AND '),
    args: [site, ...extraArgs],
  });

  async function count(env: PosterEnv, where: string, args: unknown[]) {
    const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM posters WHERE ${where}`)
      .bind(...args)
      .first<{ n: number }>();
    return r?.n ?? 0;
  }

  async function rows(env: PosterEnv, where: string, args: unknown[], limit?: number, offset = 0) {
    const sql = limit
      ? `SELECT * FROM posters WHERE ${where} ${ORDER} LIMIT ? OFFSET ?`
      : `SELECT * FROM posters WHERE ${where} ${ORDER}`;
    const bound = limit ? [...args, limit, offset] : args;
    const { results } = await env.DB.prepare(sql).bind(...bound).all<Row>();
    return results ?? [];
  }

  /** 原来读 KV 的 EXPORT_/CATEGORY_DATA_ 缓存，现在直接查 D1 */
  app.get('/api/exported-data/:category/:page', async (c) => {
    const raw = c.req.param('category');
    // /api/exported-data/metadata 是另一个路由，别被这条吃掉
    if (raw === 'metadata') return c.notFound();

    const env = (c.env as unknown) as PosterEnv;
    const page = parseInt(c.req.param('page'), 10);
    if (isNaN(page) || page < 1) return c.json({ error: '无效的页码' }, 400);

    const filters = ['category = ?'];
    const args: unknown[] = [toCategoryName(raw)];
    const version = c.req.query('version');
    if (version) {
      filters.push('version = ?');
      args.push(version);
    }

    const { where, args: a } = build(filters, args);
    const list = await rows(env, where, a, POSTERS_PER_PAGE, (page - 1) * POSTERS_PER_PAGE);
    const origin = originOf(c);

    return c.json({
      success: true,
      category: raw,
      page,
      posters: list.map((r) => shape(r, origin)),
      count: list.length,
    });
  });

  app.get('/api/exported-data/metadata', async (c) => {
    const env = (c.env as unknown) as PosterEnv;
    const { results } = await env.DB.prepare(
      `SELECT category, COUNT(*) AS n FROM posters WHERE site = ? GROUP BY category`
    )
      .bind(site)
      .all<{ category: string; n: number }>();

    const categories: Record<string, { count: number; pages: number }> = {};
    let total = 0;
    for (const r of results ?? []) {
      const key = CATEGORY_MAPPING[r.category] ?? r.category;
      categories[key] = { count: r.n, pages: Math.ceil(r.n / POSTERS_PER_PAGE) };
      total += r.n;
    }

    return c.json({
      success: true,
      metadata: {
        exportTime: new Date().toISOString(),
        totalPosters: total,
        categories,
        postersPerPage: POSTERS_PER_PAGE,
        categoryMapping: CATEGORY_MAPPING,
      },
    });
  });

  /** 分类分页，xindongfang 用它做列表页 */
  app.get('/api/poster', async (c) => {
    const env = (c.env as unknown) as PosterEnv;
    const category = c.req.query('category');
    if (!category) return c.json({ error: '缺少category参数' }, 400);

    const page = parseInt(c.req.query('page') || '1', 10) || 1;

    const filters = ['category = ?'];
    const args: unknown[] = [toCategoryName(category)];

    const version = c.req.query('version');
    if (version) {
      filters.push('version = ?');
      args.push(version);
    }
    const q = c.req.query('q');
    if (q && q.trim()) {
      const arg = likeArg(q.trim());
      filters.push(
        "(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR target_audience LIKE ? ESCAPE '\\')"
      );
      args.push(arg, arg, arg);
    }

    const { where, args: a } = build(filters, args);
    const total = await count(env, where, a);
    const totalPages = Math.ceil(total / POSTERS_PER_PAGE);
    const list = await rows(env, where, a, POSTERS_PER_PAGE, (page - 1) * POSTERS_PER_PAGE);
    const origin = originOf(c);

    return c.json({
      posters: list.map((r) => shape(r, origin)),
      totalPages,
      currentPage: page,
      hasMore: page < totalPages,
    });
  });

  /**
   * 前端搜索用的整分类索引，原来是 R2 里的静态 JSON。
   *
   * 注意 :category 也会匹配到 'global'（xindongfang 的全局搜索页在用），
   * 这种情况要返回全部分类，不能当成一个不存在的分类返回空数组。
   */
  app.get('/api/search-index/:category', async (c) => {
    const env = (c.env as unknown) as PosterEnv;
    const raw = c.req.param('category');

    const filters: string[] = [];
    const args: unknown[] = [];
    if (raw !== 'global') {
      filters.push('category = ?');
      args.push(toCategoryName(raw));
    }

    const version = c.req.query('version');
    if (version) {
      filters.push('version = ?');
      args.push(version);
    }

    const { where, args: a } = build(filters, args);
    const list = await rows(env, where, a);
    const origin = originOf(c);

    return c.json(
      list.map((r) => {
        const s = shape(r, origin);
        return {
          id: s.id,
          title: s.title,
          description: s.description,
          category: s.category,
          targetAudience: s.targetAudience,
          imageUrl: s.imageUrl,
          // xindongfang 的旧索引带 version，保留以免前端读到 undefined
          ...(r.version ? { version: r.version } : {}),
        };
      }),
      200,
      { 'Cache-Control': 'public, max-age=300' }
    );
  });

  app.get('/api/categories', async (c) => {
    const env = (c.env as unknown) as PosterEnv;
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT category FROM posters WHERE site = ? ORDER BY category`
    )
      .bind(site)
      .all<{ category: string }>();
    return c.json({ categories: (results ?? []).map((r) => r.category) });
  });

  app.get('/api/poster-metadata/all', async (c) => {
    const env = (c.env as unknown) as PosterEnv;
    const category = c.req.query('category');
    const version = c.req.query('version');

    const filters: string[] = [];
    const args: unknown[] = [];
    if (category) {
      filters.push('category = ?');
      args.push(toCategoryName(category));
    }
    if (version) {
      filters.push('version = ?');
      args.push(version);
    }

    const { where, args: a } = build(filters, args);
    const list = await rows(env, where, a);
    const origin = originOf(c);
    return c.json({ posters: list.map((r) => shape(r, origin)) });
  });

  app.get('/api/poster-metadata', async (c) => {
    const env = (c.env as unknown) as PosterEnv;
    const category = c.req.query('category');
    const page = parseInt(c.req.query('page') || '1', 10) || 1;

    // 原实现这里每页 10 条（和 exported-data 的 5 条不同），保持一致
    const perPage = 10;
    const filters: string[] = [];
    const args: unknown[] = [];
    if (category) {
      filters.push('category = ?');
      args.push(toCategoryName(category));
    }

    const { where, args: a } = build(filters, args);
    const total = await count(env, where, a);
    const list = await rows(env, where, a, perPage, (page - 1) * perPage);
    const origin = originOf(c);

    return c.json({
      posters: list.map((r) => shape(r, origin)),
      totalPages: Math.ceil(total / perPage),
      currentPage: page,
    });
  });

  app.get('/api/poster-metadata/:id', async (c) => {
    const id = c.req.param('id');
    if (id === 'all') return c.notFound(); // 交给上面那条

    const env = (c.env as unknown) as PosterEnv;
    const row = await env.DB.prepare('SELECT * FROM posters WHERE id = ? AND site = ?')
      .bind(id, site)
      .first<Row>();
    if (!row) return c.json({ error: '找不到指定的海报元数据' }, 404);
    return c.json({ poster: shape(row, originOf(c)) });
  });
}
