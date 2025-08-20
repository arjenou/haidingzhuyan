import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './config';
import { extractFileFromFormData, generateUniqueFileName, getObjectUrl } from './utils';
import { 
  PosterMetadataInput, 
  PosterMetadata,
  createPosterMetadata, 
  deletePosterMetadata, 
  getAllCategories, 
  getAllPosterMetadata, 
  getPosterMetadata, 
  updatePosterMetadata, 
  getAllPosterMetadataWithoutPagination,
  getPosterMetadataByCategory,
  updateCategoryData,
  generateAndStoreSearchIndexes,
  migrateImageUrls,
  generateFrontendData
} from './posterMetadata';
import { autoRefactorDatabase } from './autoRefactorDatabase';
import { 
  exportCategorizedDataToKV, 
  getExportedCategoryData, 
  getExportMetadata, 
  clearExportedData,
  generateStaticJSONData 
} from './exportCategorizedData';

// 创建Hono应用
const app = new Hono();

// 添加CORS中间件，允许 haidingzhuyan pages 域名
app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://api.castoneeic.com',
      'https://castoneeic.com',
      'https://haidingzhuyan.pages.dev'
    ];
    if (!origin) return origin; // 允许非浏览器请求（如 curl）
    if (allowedOrigins.includes(origin)) return origin;
    if (origin.endsWith('.haidingzhuyan.pages.dev')) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 上传海报到R2
app.post('/api/upload-poster', async (c) => {
  try {
    const formData = await c.req.formData();
    const { file, error } = await extractFileFromFormData(formData);
    
    if (error || !file) {
      return c.json({ error }, 400);
    }

    // 生成唯一文件名
    const fileName = generateUniqueFileName(file.name);
    
    // 读取文件内容
    const fileBuffer = await file.arrayBuffer();
    
    // 上传到R2
    await ((c.env as unknown) as Env).R2_BUCKET.put(fileName, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // 生成直接使用Worker的URL，确保正确编码
    const workerUrl = 'https://api.castoneeic.com';
    const encodedFileName = encodeURIComponent(fileName);
    const url = `${workerUrl}/api/get-poster-url/${encodedFileName}`;

    return c.json({ 
      success: true, 
      url,
      key: fileName
    });
  } catch (error) {
    console.error('上传错误:', error);
    return c.json({ 
      error: '文件上传失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 获取海报URL
app.get('/api/get-poster-url/:key', async (c) => {
  try {
    const key = c.req.param('key');
    console.log('获取图片，key:', key);
    
    // 从URL参数解码
    let decodedKey = key;
    try {
      // 处理可能已经被编码的key
      if (key.includes('%')) {
        decodedKey = decodeURIComponent(key);
      }
    } catch (e) {
      console.error('解码key失败:', e);
      // 如果解码失败，继续使用原始key
    }
    
    // 检查对象是否存在
    let object = await ((c.env as unknown) as Env).R2_BUCKET.head(decodedKey);
    
    // 如果找不到，尝试使用原始key
    if (!object && decodedKey !== key) {
      object = await ((c.env as unknown) as Env).R2_BUCKET.head(key);
    }
    
    if (!object) {
      console.error('找不到对象:', decodedKey, key);
      return c.json({ error: '找不到指定的海报' }, 404);
    }
    
    // 选择正确的key
    const finalKey = object ? (decodedKey !== key && !object ? key : decodedKey) : key;
    
    // 获取对象
    const data = await ((c.env as unknown) as Env).R2_BUCKET.get(finalKey);
    if (!data) {
      console.error('无法获取对象:', finalKey);
      return c.json({ error: '无法获取海报数据' }, 404);
    }
    
    // 设置正确的Content-Type
    const headers = new Headers();
    headers.set('Content-Type', data.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000');
    headers.set('Access-Control-Allow-Origin', '*');
    
    // 直接返回文件内容
    return new Response(data.body, {
      headers
    });
  } catch (error) {
    console.error('获取海报错误:', error);
    return c.json({ 
      error: '获取海报失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 获取所有海报
app.get('/api/list-posters', async (c) => {
  try {
    const objects = await ((c.env as unknown) as Env).R2_BUCKET.list({
      prefix: 'posters/'
    });
    
    const workerUrl = 'https://api.castoneeic.com';
    const posters = objects.objects.map(item => ({
      key: item.key,
      lastModified: item.uploaded,
      size: item.size,
      url: `${workerUrl}/api/get-poster-url/${encodeURIComponent(item.key)}`
    }));
    
    return c.json({ posters });
  } catch (error) {
    console.error('列表错误:', error);
    return c.json({ 
      error: '获取海报列表失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 删除海报
app.delete('/api/delete-poster/:key', async (c) => {
  try {
    const key = c.req.param('key');
    
    // 删除对象
    await ((c.env as unknown) as Env).R2_BUCKET.delete(key);
    
    return c.json({ success: true, message: '海报已删除' });
  } catch (error) {
    console.error('删除错误:', error);
    return c.json({ 
      error: '删除海报失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// ========== 海报元数据 API ==========

// 新的分页API端点
app.get('/api/poster', async (c) => {
  const category = c.req.query('category');
  const page = parseInt(c.req.query('page') || '1', 10);
  const searchQuery = c.req.query('q');
  
  if (!category) {
    return c.json({ error: '缺少category参数' }, 400);
  }
  
  try {
    const result = await getPosterMetadataByCategory((c.env as unknown) as Env, category, page, searchQuery);
    return c.json(result);
  } catch (error) {
    console.error('获取分类海报错误:', error);
    return c.json({ 
      error: '获取分类海报失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 获取所有海报元数据
app.get('/api/poster-metadata', async (c) => {
  const category = c.req.query('category');
  const page = parseInt(c.req.query('page') || '1', 10);
  
  const { posters, totalPages, currentPage } = await getAllPosterMetadata((c.env as unknown) as Env, page);
  let filtered = posters;
  if (category) {
    filtered = posters.filter(p => p.category === category);
  }
  return c.json({ posters: filtered, totalPages, currentPage });
});

// 获取所有海报元数据（不分页，用于无限滚动）
app.get('/api/poster-metadata/all', async (c) => {
  const category = c.req.query('category');
  
  // 获取所有数据
  const allPosters = await getAllPosterMetadataWithoutPagination((c.env as unknown) as Env);
  let filtered = allPosters;
  if (category) {
    filtered = allPosters.filter((p: PosterMetadata) => p.category === category);
  }
  return c.json({ posters: filtered });
});

// 获取单个海报元数据
app.get('/api/poster-metadata/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const poster = await getPosterMetadata((c.env as unknown) as Env, id);
    
    if (!poster) {
      return c.json({ error: '找不到指定的海报元数据' }, 404);
    }
    
    return c.json({ poster });
  } catch (error) {
    console.error('获取海报元数据错误:', error);
    return c.json({ 
      error: '获取海报元数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 创建海报元数据
app.post('/api/poster-metadata', async (c) => {
  try {
    const input = await c.req.json() as PosterMetadataInput;
    
    // 验证必填字段
    if (!input.title || !input.category || !input.imageKey || !input.imageUrl) {
      return c.json({
        error: '缺少必填字段',
        details: 'title, category, imageKey, imageUrl 为必填项'
      }, 400);
    }
    
    const metadata = await createPosterMetadata((c.env as unknown) as Env, input);
    return c.json({ success: true, poster: metadata });
  } catch (error) {
    console.error('创建海报元数据错误:', error);
    return c.json({ 
      error: '创建海报元数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 更新海报元数据
app.put('/api/poster-metadata/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const input = await c.req.json() as Partial<PosterMetadataInput>;
    
    const updated = await updatePosterMetadata((c.env as unknown) as Env, id, input);
    
    if (!updated) {
      return c.json({ error: '找不到指定的海报元数据' }, 404);
    }
    
    return c.json({ success: true, poster: updated });
  } catch (error) {
    console.error('更新海报元数据错误:', error);
    return c.json({ 
      error: '更新海报元数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 删除海报元数据
app.delete('/api/poster-metadata/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const success = await deletePosterMetadata((c.env as unknown) as Env, id);
    
    if (!success) {
      return c.json({ error: '找不到指定的海报元数据' }, 404);
    }
    
    return c.json({ success: true, message: '海报元数据已删除' });
  } catch (error) {
    console.error('删除海报元数据错误:', error);
    return c.json({ 
      error: '删除海报元数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 获取所有分类
app.get('/api/categories', async (c) => {
  try {
    const categories = await getAllCategories((c.env as unknown) as Env);
    return c.json({ categories });
  } catch (error) {
    console.error('获取分类错误:', error);
    return c.json({ 
      error: '获取分类失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 修复已存在的海报URL（管理员使用）
app.get('/api/fix-poster-urls', async (c) => {
  try {
    const allPosters = await getAllPosterMetadataWithoutPagination((c.env as unknown) as Env);
    const workerUrl = 'https://api.castoneeic.com';
    let fixedCount = 0;
    
    for (const poster of allPosters) {
      // 检查URL是否需要更新（如果包含cloudflare storage URL或不是正确的API URL）
      if (poster.imageKey && poster.imageUrl && 
          (poster.imageUrl.includes('cloudflarestorage.com') || 
           poster.imageUrl.includes('api.castoneeic.com') ||
           !poster.imageUrl.includes('haidingzhuyan-api.wangyunjie1101.workers.dev'))) {
        
        // 确保正确编码文件名
        const encodedKey = encodeURIComponent(poster.imageKey);
        const newUrl = `${workerUrl}/api/get-poster-url/${encodedKey}`;
        
        // 更新海报元数据
        await updatePosterMetadata((c.env as unknown) as Env, poster.id, {
          imageUrl: newUrl
        });
        
        fixedCount++;
      }
    }
    
    return c.json({ 
      success: true, 
      message: `已修复 ${fixedCount} 个海报URL`
    });
  } catch (error) {
    console.error('修复URL错误:', error);
    return c.json({ 
      error: '修复URL失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 强力修复所有URL
app.get('/api/force-fix-urls', async (c) => {
  try {
    const allPosters = await getAllPosterMetadataWithoutPagination((c.env as unknown) as Env);
    const workerUrl = 'https://api.castoneeic.com';
    let fixedCount = 0;
    
    for (const poster of allPosters) {
      if (poster.imageKey && poster.imageUrl && 
          (poster.imageUrl.includes('api.castoneeic.com') ||
           poster.imageUrl.includes('haidingzhuyan-api.wangyunjie1101.workers.dev') ||
           poster.imageUrl.includes('https://haidingzhuyan/'))) {
        
        const encodedKey = encodeURIComponent(poster.imageKey);
        const newUrl = `${workerUrl}/api/get-poster-url/${encodedKey}`;
        
        // 直接更新KV存储
        const updatedPoster = {
          ...poster,
          imageUrl: newUrl,
          updatedAt: Date.now()
        };
        
        await ((c.env as unknown) as Env).POSTER_METADATA.put(poster.id, JSON.stringify(updatedPoster));
        fixedCount++;
      }
    }
    
    return c.json({ 
      success: true, 
      message: `强制修复了 ${fixedCount} 个海报URL`
    });
  } catch (error) {
    console.error('强制修复URL错误:', error);
    return c.json({ 
      error: '强制修复失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 强制修复特定海报URL（用于解决中文编码问题）
app.get('/api/fix-specific-poster', async (c) => {
  try {
    // 特定海报ID
    const posterId = 'poster_1749735227978_4jzt2sq';
    
    // 获取海报数据
    const poster = await getPosterMetadata((c.env as unknown) as Env, posterId);
    if (!poster) {
      return c.json({ error: '找不到指定的海报' }, 404);
    }
    
    // 生成正确编码的URL
    const workerUrl = 'https://api.castoneeic.com';
    const encodedKey = encodeURIComponent(poster.imageKey);
    const newUrl = `${workerUrl}/api/get-poster-url/${encodedKey}`;
    
    // 输出调试信息
    console.log('原始URL:', poster.imageUrl);
    console.log('新URL:', newUrl);
    console.log('原始Key:', poster.imageKey);
    console.log('编码Key:', encodedKey);
    
    // 更新海报元数据
    await updatePosterMetadata((c.env as unknown) as Env, posterId, {
      imageUrl: newUrl
    });
    
    return c.json({
      success: true,
      message: '已修复海报URL',
      oldUrl: poster.imageUrl,
      newUrl: newUrl
    });
  } catch (error) {
    console.error('修复特定海报URL错误:', error);
    return c.json({ 
      error: '修复特定海报URL失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 获取搜索索引文件的代理API
app.get('/api/search-index/:category', async (c) => {
  const category = c.req.param('category');
  const fileName = `search-indexes/${category}.json`;

  try {
    const object = await ((c.env as unknown) as Env).R2_BUCKET.get(fileName);

    if (object === null) {
      return c.json({ error: '找不到指定的搜索索引' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=3600'); // 客户端缓存1小时

    return new Response(object.body, {
      headers,
    });

  } catch (error) {
    console.error(`获取搜索索引失败: ${fileName}`, error);
    return c.json({ 
      error: '获取搜索索引失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 手动触发搜索索引生成
app.post('/api/build-search-indexes', async (c) => {
  try {
    const results = await generateAndStoreSearchIndexes((c.env as unknown) as Env);
    return c.json({ success: true, message: '搜索索引生成成功', details: results });
  } catch (error) {
    console.error('搜索索引生成错误:', error);
    return c.json({ 
      error: '搜索索引生成失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 删除搜索索引文件
app.delete('/api/admin/clear-search-indexes', async (c) => {
  try {
    const categories = ['gongke', 'wenke', 'shangke', 'like'];
    let deletedCount = 0;
    
    for (const category of categories) {
      const fileName = `search-indexes/${category}.json`;
      try {
        await ((c.env as unknown) as Env).R2_BUCKET.delete(fileName);
        deletedCount++;
        console.log(`已删除搜索索引文件: ${fileName}`);
      } catch (e) {
        console.log(`文件不存在或删除失败: ${fileName}`);
      }
    }
    
    return c.json({ 
      success: true, 
      message: `已删除 ${deletedCount} 个搜索索引文件`
    });
  } catch (error) {
    console.error('删除搜索索引文件失败:', error);
    return c.json({ 
      error: '删除搜索索引文件失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 触发数据库重构（管理员功能）
app.post('/api/refactor-database', async (c) => {
  try {
    await autoRefactorDatabase((c.env as unknown) as Env);
    return c.json({ success: true, message: '数据库重构完成' });
  } catch (error) {
    console.error('数据库重构错误:', error);
    return c.json({ 
      error: '数据库重构失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 触发图片URL迁移
app.post('/api/admin/migrate-urls', async (c) => {
  try {
    const result = await migrateImageUrls((c.env as unknown) as Env);
    return c.json({ success: true, ...result });
  } catch (error) {
    console.error('URL迁移任务失败:', error);
    return c.json({ 
      error: 'URL迁移任务失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 生成前端数据文件
app.get('/api/admin/generate-frontend-data', async (c) => {
  try {
    const data = await generateFrontendData((c.env as unknown) as Env);
    return c.json(data);
  } catch (error) {
    console.error('生成前端数据失败:', error);
    return c.json({ 
      error: '生成前端数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// ========== 分类分页导出 API ==========

// 导出分类分页数据到KV
app.post('/api/admin/export-categorized-data', async (c) => {
  try {
    const result = await exportCategorizedDataToKV((c.env as unknown) as Env);
    return c.json({ 
      success: true, 
      message: '分类分页数据导出成功',
      ...result
    });
  } catch (error) {
    console.error('导出分类分页数据失败:', error);
    return c.json({ 
      error: '导出分类分页数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 获取导出的分类分页数据
app.get('/api/exported-data/:category/:page', async (c) => {
  try {
    const category = c.req.param('category');
    const page = parseInt(c.req.param('page'), 10);
    
    if (isNaN(page) || page < 1) {
      return c.json({ error: '无效的页码' }, 400);
    }
    
    const data = await getExportedCategoryData((c.env as unknown) as Env, category, page);
    
    if (!data) {
      return c.json({ error: '找不到指定的数据' }, 404);
    }
    
    return c.json({ 
      success: true,
      category,
      page,
      posters: data,
      count: data.length
    });
  } catch (error) {
    console.error('获取导出的分类数据失败:', error);
    return c.json({ 
      error: '获取导出的分类数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 获取导出元数据
app.get('/api/exported-data/metadata', async (c) => {
  try {
    const metadata = await getExportMetadata((c.env as unknown) as Env);
    
    if (!metadata) {
      return c.json({ error: '没有找到导出的数据' }, 404);
    }
    
    return c.json({ 
      success: true,
      metadata
    });
  } catch (error) {
    console.error('获取导出元数据失败:', error);
    return c.json({ 
      error: '获取导出元数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 清理导出的数据
app.delete('/api/admin/exported-data', async (c) => {
  try {
    await clearExportedData((c.env as unknown) as Env);
    return c.json({ 
      success: true, 
      message: '导出的数据已清理'
    });
  } catch (error) {
    console.error('清理导出数据失败:', error);
    return c.json({ 
      error: '清理导出数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 生成静态JSON数据（用于前端直接使用）
app.get('/api/admin/static-json-data', async (c) => {
  try {
    const data = await generateStaticJSONData((c.env as unknown) as Env);
    return c.json({ 
      success: true,
      data
    });
  } catch (error) {
    console.error('生成静态JSON数据失败:', error);
    return c.json({ 
      error: '生成静态JSON数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 完全修复所有数据并重新导出
app.get('/api/complete-fix-all', async (c) => {
  try {
    // 1. 修复KV中的所有数据
    const allPosters = await getAllPosterMetadataWithoutPagination((c.env as unknown) as Env);
    const workerUrl = 'https://api.castoneeic.com';
    let fixedCount = 0;
    
    for (const poster of allPosters) {
      if (poster.imageKey && poster.imageUrl && 
          (poster.imageUrl.includes('api.castoneeic.com') ||
           poster.imageUrl.includes('haidingzhuyan-api.wangyunjie1101.workers.dev') ||
           poster.imageUrl.includes('https://haidingzhuyan/'))) {
        
        const encodedKey = encodeURIComponent(poster.imageKey);
        const newUrl = `${workerUrl}/api/get-poster-url/${encodedKey}`;
        
        const updatedPoster = {
          ...poster,
          imageUrl: newUrl,
          updatedAt: Date.now()
        };
        
        await ((c.env as unknown) as Env).POSTER_METADATA.put(poster.id, JSON.stringify(updatedPoster));
        fixedCount++;
      }
    }
    
    // 2. 重新导出分类数据
    const exportResult = await exportCategorizedDataToKV((c.env as unknown) as Env);
    
    return c.json({ 
      success: true, 
      message: `完全修复完成`,
      fixedPosters: fixedCount,
      exportResult
    });
  } catch (error) {
    console.error('完全修复错误:', error);
    return c.json({ 
      error: '完全修复失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 清理所有缓存和索引，强制重建
app.get('/api/admin/clear-cache-and-rebuild', async (c) => {
  try {
    const env = (c.env as unknown) as Env;
    
    // 1. 清理索引
    const listResult = await env.POSTER_METADATA.list();
    const deletePromises: Promise<void>[] = [];
    
    for (const key of listResult.keys) {
      if (key.name.startsWith('POSTER_METADATA_INDEX_') || 
          key.name === 'POSTER_METADATA_COUNT' ||
          key.name.startsWith('CATEGORY_DATA_') ||
          key.name.startsWith('SEARCH_INDEX_')) {
        deletePromises.push(env.POSTER_METADATA.delete(key.name));
      }
    }
    
    await Promise.all(deletePromises);
    
    // 2. 强制重新获取所有数据（这会触发重建）
    const allPosters = await getAllPosterMetadataWithoutPagination(env);
    
    // 3. 重新导出分类数据
    const exportResult = await exportCategorizedDataToKV(env);
    
    return c.json({ 
      success: true, 
      message: `缓存清理完成，重建了${allPosters.length}个海报的索引`,
      exportResult
    });
  } catch (error) {
    console.error('清理缓存错误:', error);
    return c.json({ 
      error: '清理缓存失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 导出Worker处理函数
export default app; 