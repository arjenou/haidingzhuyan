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

/** 列表缩略图宽度。必须和后端 THUMB_WIDTH 一致，才会命中同一种缓存。 */
export const POSTER_THUMB_WIDTH = 360;

export function posterThumbUrl(imageUrl: string): string {
  if (!imageUrl) return '';
  try {
    const url = new URL(imageUrl);
    url.searchParams.set('w', String(POSTER_THUMB_WIDTH));
    return url.toString();
  } catch {
    return imageUrl;
  }
}

let metadataPromise: Promise<{
  categories: Record<string, { count: number; pages: number }>;
}> | null = null;

/**
 * 根据分类获取海报元数据（分页）
 * 页数据和总页数并行请求，总页数在本次打开里只拉一次。
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

  const [response, metadata] = await Promise.all([
    fetch(url),
    getExportMetadata(),
  ]);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || '获取分类海报失败');
  }

  const data = await response.json();
  const totalPages = metadata.categories[categoryId]?.pages || 0;

  return {
    posters: data.posters || [],
    totalPages,
    currentPage: page,
    hasMore: page < totalPages,
  };
};

const searchCache = new Map<string, PosterMetadata[]>();

/** 服务端按关键词查询，只返回命中的海报。 */
export async function searchPosters(query: string, signal?: AbortSignal): Promise<PosterMetadata[]> {
  const q = query.trim();
  if (!q) return [];

  const cached = searchCache.get(q);
  if (cached) return cached;

  const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(q)}`, { signal });
  if (!response.ok) throw new Error('搜索失败');

  const data = await response.json() as { posters?: PosterMetadata[] };
  const posters = data.posters ?? [];
  searchCache.set(q, posters);
  if (searchCache.size > 30) {
    const oldest = searchCache.keys().next().value;
    if (oldest) searchCache.delete(oldest);
  }
  return posters;
}

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

/** getPosterMetadataByCategory 用它拿总页数。失败后下次会重新请求。 */
function getExportMetadata(): Promise<{
  categories: Record<string, { count: number; pages: number }>;
}> {
  if (!metadataPromise) {
    metadataPromise = fetch(`${API_BASE_URL}/exported-data/metadata`)
      .then(async (response) => {
        if (!response.ok) throw new Error('获取导出元数据失败');
        const data = await response.json();
        return data.metadata;
      })
      .catch((error) => {
        metadataPromise = null;
        throw error;
      });
  }
  return metadataPromise;
}
