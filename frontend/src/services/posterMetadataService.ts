// 可以根据需要替换为您的Cloudflare Workers URL
// 部署时手动更改此URL或使用环境变量
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.castoneeic.com/api';

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

/** getPosterMetadataByCategory 用它拿总页数 */
async function getExportMetadata(): Promise<{
  categories: Record<string, { count: number; pages: number }>;
}> {
  const response = await fetch(`${API_BASE_URL}/exported-data/metadata`);
  if (!response.ok) throw new Error('获取导出元数据失败');
  const data = await response.json();
  return data.metadata;
}
