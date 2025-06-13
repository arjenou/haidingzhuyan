// 可以根据需要替换为您的Cloudflare Workers URL
// 部署时手动更改此URL或使用环境变量
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787/api';
import { getCategoryIds } from '../constants/categories';

// 调试日志
console.log('API_BASE_URL:', API_BASE_URL);

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
  try {
    // 安全处理输入数据，确保没有特殊字符问题
    const cleanInput = {
      ...input,
      title: input.title.trim(),
      description: input.description ? input.description.trim() : '',
      category: input.category.trim(),
      targetAudience: input.targetAudience || []
    };
    
    // 调试日志
    console.log('提交数据:', JSON.stringify(cleanInput));
    
    const response = await fetch(`${API_BASE_URL}/poster-metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cleanInput),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API错误响应:', errorText);
      
      let errorMessage = '创建海报元数据失败';
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error('解析错误响应失败:', e);
      }
      
      throw new Error(errorMessage);
    }
    
    const responseText = await response.text();
    console.log('API响应:', responseText);
    
    try {
      const data = JSON.parse(responseText);
      return data.poster;
    } catch (e) {
      console.error('解析响应JSON失败:', e);
      throw new Error('解析服务器响应失败');
    }
  } catch (error) {
    console.error('创建海报元数据错误:', error);
    throw error;
  }
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
 * 返回固定的分类列表
 */
export const getAllCategories = async (): Promise<string[]> => {
  return getCategoryIds();
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
  console.log('所有海报数量:', allPosters.length);
  console.log('筛选条件 - 搜索词:', query, '分类:', category);
  
  // 按分类筛选
  let filteredPosters = allPosters;
  if (category && category.trim() !== '') {
    filteredPosters = filteredPosters.filter(poster => {
      const categoryMatch = poster.category.toLowerCase() === category.toLowerCase();
      if (categoryMatch) {
        console.log('匹配分类:', poster.title, poster.category);
      }
      return categoryMatch;
    });
    console.log('分类筛选后的海报数量:', filteredPosters.length);
  }
  
  // 如果没有搜索关键词，直接返回分类筛选结果
  if (!query || query.trim() === '') {
    return filteredPosters;
  }
  
  // 转换搜索关键词为小写
  const lowercaseQuery = query.toLowerCase();
  
  // 按标题、描述和目标受众搜索
  const searchResults = filteredPosters.filter(poster => {
    const titleMatches = poster.title.toLowerCase().includes(lowercaseQuery);
    const descriptionMatches = poster.description.toLowerCase().includes(lowercaseQuery);
    const targetAudienceMatches = poster.targetAudience.some(audience => 
      audience.toLowerCase().includes(lowercaseQuery)
    );
    
    return titleMatches || descriptionMatches || targetAudienceMatches;
  });
  
  console.log('搜索后的海报数量:', searchResults.length);
  return searchResults;
}; 