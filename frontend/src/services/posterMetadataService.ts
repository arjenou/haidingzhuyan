// 可以根据需要替换为您的Cloudflare Workers URL
// 部署时手动更改此URL或使用环境变量
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.capstoneketi.com/api';
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

// 新增分页类型
export interface PosterMetadataPage {
  posters: PosterMetadata[];
  totalPages: number;
  currentPage: number;
}

/**
 * 根据分类获取海报元数据（分页）
 */
export const getPosterMetadataByCategory = async (
  category: string, 
  page: number = 1
): Promise<{
  posters: PosterMetadata[];
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
}> => {
  const categoryId = getCategoryId(category);
  const url = `${API_BASE_URL}/exported-data/${encodeURIComponent(categoryId)}/${page}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || '获取分类海报失败');
  }

  const data = await response.json();

  // 后端返回的数据结构是 { success: true, posters: [...] }
  // 我们需要从元数据获取总页数
  const metadata = await getExportMetadata();
  const totalPages = metadata.categories[categoryId]?.pages || 0;

  return {
    posters: data.posters || [],
    totalPages,
    currentPage: page,
    hasMore: page < totalPages,
  };
};

const categoryMapping: { [key: string]: string } = {
  '工科': 'gongke',
  '理科': 'like',
  '文科': 'wenke',
  '商科': 'shangke',
};

function getCategoryId(categoryName: string): string {
  return categoryMapping[categoryName] || categoryName;
}

/**
 * 获取所有海报元数据
 */
export const getAllPosterMetadata = async (category?: string, page: number = 1): Promise<PosterMetadataPage> => {
  let url = `${API_BASE_URL}/poster-metadata?page=${page}`;
  if (category) {
    url += `&category=${encodeURIComponent(category)}`;
  }
  const response = await fetch(url);
  return response.json();
};

/**
 * 获取所有海报元数据（不分页，用于无限滚动）
 */
export const getAllPosterMetadataForInfiniteScroll = async (category?: string): Promise<PosterMetadata[]> => {
  let url = `${API_BASE_URL}/poster-metadata/all`;
  if (category) {
    url += `?category=${encodeURIComponent(category)}`;
  }
  const response = await fetch(url);
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

export interface ExportMetadata {
  exportTime: string;
  totalPosters: number;
  categories: {
    [key: string]: {
      count: number;
      pages: number;
    };
  };
  postersPerPage: number;
  categoryMapping: {
    [key: string]: string;
  };
}

let metadataCache: ExportMetadata | null = null;

export const getExportMetadata = async (): Promise<ExportMetadata> => {
  if (metadataCache) {
    return metadataCache;
  }
  const response = await fetch(`${API_BASE_URL}/exported-data/metadata`);
  if (!response.ok) {
    throw new Error('获取元数据失败');
  }
  const data = await response.json();
  if (data.success) {
    metadataCache = data.metadata;
    return data.metadata;
  }
  throw new Error(data.message || '解析元数据失败');
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
  const { posters: allPosters } = await getAllPosterMetadata();
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