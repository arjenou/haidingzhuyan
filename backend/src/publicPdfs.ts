// 公开 PDF 只读接口。
//
// 这份文件在四个站点项目里是完全相同的副本（由 capstone-admin/shared/ 同步过去），
// 改动请改 capstone-admin/shared/publicPdfs.ts 后重新分发，不要单独改某一个站点。
//
// 数据来自统一后台的 D1「capstone」库，按 site 列区分站点。
// 这里只读，写操作全部在 capstone-admin-api 上，需要登录。

import type { Hono } from 'hono';

export interface PdfEnv {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
}

interface PdfRow {
  id: string;
  poster_id: string | null;
  title: string;
  description: string;
  category: string | null;
  r2_key: string;
  file_name: string;
  size: number;
  sort_order: number;
  version: string | null;
  created_at: number;
  updated_at: number;
}

const MAX_PER_PAGE = 100;

/** 转义 LIKE 通配符，否则用户搜个 % 就会匹配全部 */
function likeArg(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
}

function shape(row: PdfRow, origin: string) {
  return {
    id: row.id,
    posterId: row.poster_id,
    title: row.title,
    description: row.description,
    category: row.category,
    fileName: row.file_name,
    size: row.size,
    version: row.version,
    url: `${origin}/api/pdf/${row.id}`,
    downloadUrl: `${origin}/api/pdf/${row.id}?download=1`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @param app  站点的 Hono 实例
 * @param site 该站点在 D1 里的 site 值，如 'qide'
 */
export function registerPublicPdfRoutes(
  app: Hono,
  site: string
): void {
  // 列表
  app.get('/api/pdfs', async (c) => {
    try {
      const env = (c.env as unknown) as PdfEnv;
      if (!env.DB) return c.json({ error: 'PDF 功能未启用' }, 503);

      const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
      const perPage = Math.min(
        MAX_PER_PAGE,
        Math.max(1, parseInt(c.req.query('perPage') || '20', 10) || 20)
      );

      const where: string[] = ['site = ?'];
      const args: unknown[] = [site];

      const category = c.req.query('category');
      if (category) {
        where.push('category = ?');
        args.push(category);
      }

      // xindongfang 的 standard / pro 是互斥分区，前端必须带上自己的版本
      const version = c.req.query('version');
      if (version) {
        where.push('version = ?');
        args.push(version);
      }

      const posterId = c.req.query('posterId');
      if (posterId) {
        where.push('poster_id = ?');
        args.push(posterId);
      }

      const q = c.req.query('q');
      if (q && q.trim()) {
        const arg = likeArg(q.trim());
        where.push(
          "(title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR file_name LIKE ? ESCAPE '\\')"
        );
        args.push(arg, arg, arg);
      }

      const whereSql = where.join(' AND ');

      const countRow = await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM pdfs WHERE ${whereSql}`
      )
        .bind(...args)
        .first<{ n: number }>();
      const total = countRow?.n ?? 0;

      const { results } = await env.DB.prepare(
        `SELECT * FROM pdfs WHERE ${whereSql}
         ORDER BY sort_order ASC, created_at DESC, id DESC
         LIMIT ? OFFSET ?`
      )
        .bind(...args, perPage, (page - 1) * perPage)
        .all<PdfRow>();

      const origin = new URL(c.req.url).origin;
      return c.json({
        pdfs: (results ?? []).map((r) => shape(r, origin)),
        total,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      });
    } catch (error) {
      console.error('获取 PDF 列表失败:', error);
      return c.json(
        {
          error: '获取 PDF 列表失败',
          details: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  });

  // 单个 PDF 的元数据
  app.get('/api/pdf-meta/:id', async (c) => {
    try {
      const env = (c.env as unknown) as PdfEnv;
      if (!env.DB) return c.json({ error: 'PDF 功能未启用' }, 503);

      const row = await env.DB.prepare('SELECT * FROM pdfs WHERE id = ? AND site = ?')
        .bind(c.req.param('id'), site)
        .first<PdfRow>();
      if (!row) return c.json({ error: '找不到该 PDF' }, 404);

      return c.json({ pdf: shape(row, new URL(c.req.url).origin) });
    } catch (error) {
      console.error('获取 PDF 元数据失败:', error);
      return c.json(
        {
          error: '获取 PDF 元数据失败',
          details: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  });

  // 文件内容：从 R2 流式返回
  app.get('/api/pdf/:id', async (c) => {
    try {
      const env = (c.env as unknown) as PdfEnv;
      if (!env.DB) return c.json({ error: 'PDF 功能未启用' }, 503);

      const row = await env.DB.prepare(
        'SELECT r2_key, file_name FROM pdfs WHERE id = ? AND site = ?'
      )
        .bind(c.req.param('id'), site)
        .first<{ r2_key: string; file_name: string }>();
      if (!row) return c.json({ error: '找不到该 PDF' }, 404);

      const obj = await env.R2_BUCKET.get(row.r2_key);
      if (!obj) return c.json({ error: '文件不存在' }, 404);

      const disposition = c.req.query('download') === '1' ? 'attachment' : 'inline';
      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Cache-Control', 'public, max-age=3600');
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('etag', obj.httpEtag);
      headers.set(
        'Content-Disposition',
        `${disposition}; filename*=UTF-8''${encodeURIComponent(row.file_name)}`
      );

      return new Response(obj.body, { headers });
    } catch (error) {
      console.error('获取 PDF 失败:', error);
      return c.json(
        {
          error: '获取 PDF 失败',
          details: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  });
}
