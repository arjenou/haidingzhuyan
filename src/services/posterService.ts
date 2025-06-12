// 可以根据需要替换为您的Cloudflare Workers URL
// 部署时手动更改此URL或使用环境变量
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787/api';

export interface PosterItem {
  key: string;
  url: string;
  lastModified: string;
  size: number;
}

/**
 * 上传海报文件到R2存储
 * @param file 要上传的文件
 * @returns 上传结果，包含URL和key
 */
export const uploadPoster = async (file: File): Promise<{ url: string; key: string }> => {
  const formData = new FormData();
  formData.append('poster', file);

  const response = await fetch(`${API_BASE_URL}/upload-poster`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '上传失败');
  }

  return response.json();
};

/**
 * 获取海报的预签名下载URL
 * @param key 海报的key
 * @returns 包含签名URL的对象
 */
export const getPosterDownloadUrl = async (key: string): Promise<{ url: string }> => {
  const response = await fetch(`${API_BASE_URL}/get-poster-url/${encodeURIComponent(key)}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '获取下载链接失败');
  }

  return response.json();
};

/**
 * 获取所有海报列表
 * @returns 海报列表
 */
export const listPosters = async (): Promise<{ posters: PosterItem[] }> => {
  const response = await fetch(`${API_BASE_URL}/list-posters`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '获取海报列表失败');
  }

  return response.json();
};

/**
 * 删除海报
 * @param key 要删除的海报key
 * @returns 删除结果
 */
export const deletePoster = async (key: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/delete-poster/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '删除海报失败');
  }

  return response.json();
}; 