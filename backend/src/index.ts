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

    // 生成URL
    const url = getObjectUrl(c.env, fileName);

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
    
    // 检查对象是否存在
    const object = await c.env.R2_BUCKET.head(key);
    if (!object) {
      return c.json({ error: '找不到指定的海报' }, 404);
    }
    
    const url = getObjectUrl(c.env, key);
    
    return c.json({ url });
  } catch (error) {
    console.error('获取URL错误:', error);
    return c.json({ 
      error: '获取下载URL失败', 
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
    
    const posters = objects.objects.map(item => ({
      key: item.key,
      lastModified: item.uploaded,
      size: item.size,
      url: getObjectUrl(c.env, item.key)
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

// 导出Worker处理函数
export default app; 