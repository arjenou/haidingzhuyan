import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './config';
import { extractFileFromFormData, generateUniqueFileName, getObjectUrl } from './utils';
import { 
  PosterMetadataInput, 
  createPosterMetadata, 
  deletePosterMetadata, 
  getAllCategories, 
  getAllPosterMetadata, 
  getPosterMetadata, 
  updatePosterMetadata 
} from './posterMetadata';

// 创建Hono应用
const app = new Hono<{ Bindings: Env }>();

// 添加CORS中间件
app.use('*', cors());

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
    await c.env.R2_BUCKET.put(fileName, fileBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // 生成直接使用Worker的URL，确保正确编码
    const workerUrl = 'https://xinhangdao-api.wangyunjie1101.workers.dev';
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
    let object = await c.env.R2_BUCKET.head(decodedKey);
    
    // 如果找不到，尝试使用原始key
    if (!object && decodedKey !== key) {
      object = await c.env.R2_BUCKET.head(key);
    }
    
    if (!object) {
      console.error('找不到对象:', decodedKey, key);
      return c.json({ error: '找不到指定的海报' }, 404);
    }
    
    // 选择正确的key
    const finalKey = object ? (decodedKey !== key && !object ? key : decodedKey) : key;
    
    // 获取对象
    const data = await c.env.R2_BUCKET.get(finalKey);
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
    const objects = await c.env.R2_BUCKET.list({
      prefix: 'posters/'
    });
    
    const workerUrl = 'https://xinhangdao-api.wangyunjie1101.workers.dev';
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
    await c.env.R2_BUCKET.delete(key);
    
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

// 获取所有海报元数据
app.get('/api/poster-metadata', async (c) => {
  try {
    const posters = await getAllPosterMetadata(c.env);
    return c.json({ posters });
  } catch (error) {
    console.error('获取海报元数据错误:', error);
    return c.json({ 
      error: '获取海报元数据失败', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// 获取单个海报元数据
app.get('/api/poster-metadata/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const poster = await getPosterMetadata(c.env, id);
    
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
    
    const metadata = await createPosterMetadata(c.env, input);
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
    
    const updated = await updatePosterMetadata(c.env, id, input);
    
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
    const success = await deletePosterMetadata(c.env, id);
    
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
    const categories = await getAllCategories(c.env);
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
    const posters = await getAllPosterMetadata(c.env);
    const workerUrl = 'https://xinhangdao-api.wangyunjie1101.workers.dev';
    let fixedCount = 0;
    
    for (const poster of posters) {
      // 检查URL是否需要更新（如果包含cloudflare storage URL或不是workers URL）
      if ((poster.imageUrl.includes('cloudflarestorage.com') || 
           !poster.imageUrl.includes('xinhangdao-api.wangyunjie1101.workers.dev')) && 
          poster.imageKey) {
        
        // 确保正确编码文件名
        const encodedKey = encodeURIComponent(poster.imageKey);
        const newUrl = `${workerUrl}/api/get-poster-url/${encodedKey}`;
        
        // 更新海报元数据
        await updatePosterMetadata(c.env, poster.id, {
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

// 强制修复特定海报URL（用于解决中文编码问题）
app.get('/api/fix-specific-poster', async (c) => {
  try {
    // 特定海报ID
    const posterId = 'poster_1749735227978_4jzt2sq';
    
    // 获取海报数据
    const poster = await getPosterMetadata(c.env, posterId);
    if (!poster) {
      return c.json({ error: '找不到指定的海报' }, 404);
    }
    
    // 生成正确编码的URL
    const workerUrl = 'https://xinhangdao-api.wangyunjie1101.workers.dev';
    const encodedKey = encodeURIComponent(poster.imageKey);
    const newUrl = `${workerUrl}/api/get-poster-url/${encodedKey}`;
    
    // 输出调试信息
    console.log('原始URL:', poster.imageUrl);
    console.log('新URL:', newUrl);
    console.log('原始Key:', poster.imageKey);
    console.log('编码Key:', encodedKey);
    
    // 更新海报元数据
    await updatePosterMetadata(c.env, posterId, {
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

// 导出Worker处理函数
export default app; 