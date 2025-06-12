import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './config';
import { extractFileFromFormData, generateUniqueFileName, getObjectUrl } from './utils';

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

// 导出Worker处理函数
export default app; 