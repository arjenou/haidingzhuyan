import { Env } from './config';

/**
 * 生成唯一文件名
 */
export function generateUniqueFileName(originalName: string): string {
  const timestamp = Date.now();
  const fileName = originalName.replace(/\s+/g, '-');
  return `posters/${timestamp}-${fileName}`;
}

/**
 * 从表单数据中提取文件
 */
export async function extractFileFromFormData(
  formData: FormData
): Promise<{ file: File | null; error: string | null }> {
  const poster = formData.get('poster');
  
  if (!poster || typeof poster !== 'object' || !('name' in poster)) {
    return { file: null, error: '没有上传文件或文件格式不正确' };
  }
  
  const file = poster as File;
  
  // 检查文件大小 (5MB限制)
  if (file.size > 5 * 1024 * 1024) {
    return { file: null, error: '文件大小超过5MB限制' };
  }
  
  return { file, error: null };
}

/**
 * 生成R2对象的公共URL
 * 使用Cloudflare Workers直接提供的R2公开访问URL
 */
export function getObjectUrl(env: Env, key: string): string {
  // 这里使用Cloudflare Workers的URL模式
  // 基础URL是Worker的URL，然后添加路径
  const workerUrl = 'https://haidingzhuyan-api.wangyunjie1101.workers.dev';
  return `${workerUrl}/api/get-poster-url/${key}`;
} 