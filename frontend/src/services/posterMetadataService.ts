// 可以根据需要替换为您的Cloudflare Workers URL
// 部署时手动更改此URL或使用环境变量
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787/api';

export interface PosterMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  targetAudience: string[];
  imageKey: string;
  imageUrl: string;
  createdAt: number;
  updatedAt: number;
}

export interface PosterMetadataInput {
  title: string;
  description?: string;
  category: string;
  targetAudience?: string[];
  imageKey: string;
  imageUrl: string;
}

/**
 * 获取所有海报元数据
 */
export const getAllPosterMetadata = async (): Promise<PosterMetadata[]> => {
  const response = await fetch(`${API_BASE_URL}/poster-metadata`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '获取海报元数据失败');
  }

  const data = await response.json();
  return data.posters;
};

/**
 * 获取单个海报元数据
 */
export const getPosterMetadata = async (id: string): Promise<PosterMetadata> => {
  const response = await fetch(`${API_BASE_URL}/poster-metadata/${encodeURIComponent(id)}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '获取海报元数据失败');
  }

  const data = await response.json();
  return data.poster;
};

/**
 * 创建海报元数据
 */
export const createPosterMetadata = async (input: PosterMetadataInput): Promise<PosterMetadata> => {
  const response = await fetch(`${API_BASE_URL}/poster-metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '创建海报元数据失败');
  }

  const data = await response.json();
  return data.poster;
};

/**
 * 更新海报元数据
 */
export const updatePosterMetadata = async (id: string, input: Partial<PosterMetadataInput>): Promise<PosterMetadata> => {
  const response = await fetch(`${API_BASE_URL}/poster-metadata/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '更新海报元数据失败');
  }

  const data = await response.json();
  return data.poster;
};

/**
 * 删除海报元数据
 */
export const deletePosterMetadata = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/poster-metadata/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '删除海报元数据失败');
  }
};

/**
 * 获取所有分类
 */
export const getAllCategories = async (): Promise<string[]> => {
  const response = await fetch(`${API_BASE_URL}/categories`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '获取分类失败');
  }

  const data = await response.json();
  return data.categories;
};

/**
 * 搜索海报元数据
 * 客户端实现的搜索功能
 */
export const searchPosterMetadata = async (
  query: string, 
  category?: string
): Promise<PosterMetadata[]> => {
  // 获取所有海报元数据
  const allPosters = await getAllPosterMetadata();
  
  // 如果没有搜索条件，返回所有（或按分类筛选）
  if (!query && !category) {
    return allPosters;
  }
  
  // 按分类筛选
  let filteredPosters = allPosters;
  if (category) {
    filteredPosters = filteredPosters.filter(poster => 
      poster.category.toLowerCase() === category.toLowerCase()
    );
  }
  
  // 如果没有搜索关键词，直接返回分类筛选结果
  if (!query) {
    return filteredPosters;
  }
  
  // 转换搜索关键词为小写
  const lowercaseQuery = query.toLowerCase();
  
  // 按标题、描述和目标受众搜索
  return filteredPosters.filter(poster => {
    const titleMatches = poster.title.toLowerCase().includes(lowercaseQuery);
    const descriptionMatches = poster.description.toLowerCase().includes(lowercaseQuery);
    const targetAudienceMatches = poster.targetAudience.some(audience => 
      audience.toLowerCase().includes(lowercaseQuery)
    );
    
    return titleMatches || descriptionMatches || targetAudienceMatches;
  });
}; 