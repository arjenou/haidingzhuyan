import { Env } from './config';
import { getAllPosterMetadataWithoutPagination, fixPosterUrl } from './posterMetadata';

// 分类映射
const CATEGORY_MAPPING = {
  '工科': 'gongke',
  '文科': 'wenke', 
  '商科': 'shangke',
  '理科': 'like'
};

// 每页记录数
const POSTERS_PER_PAGE = 5;

interface PosterMetadata {
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

/**
 * 获取分类的英文键名
 */
function getCategoryKey(categoryName: string): string {
  // 检查 categoryName 是否为 undefined 或 null
  if (!categoryName || categoryName.trim() === '') {
    console.warn('分类名称为空，跳过该记录');
    return ''; // 返回空字符串，让调用方决定如何处理
  }
  
  return CATEGORY_MAPPING[categoryName as keyof typeof CATEGORY_MAPPING] || categoryName.toLowerCase();
}

/**
 * 导出分类分页数据到KV存储
 */
export async function exportCategorizedDataToKV(env: Env): Promise<{
  totalPosters: number;
  categories: Record<string, { count: number; pages: number }>;
}> {
  console.log('开始导出分类分页数据到KV...');
  
  // 获取所有海报数据
  const allPosters = await getAllPosterMetadataWithoutPagination(env);
  console.log(`总共获取到 ${allPosters.length} 条海报数据`);
  
  // 按分类分组
  const postersByCategory: Record<string, PosterMetadata[]> = {};
  
  allPosters.forEach(poster => {
    const categoryKey = getCategoryKey(poster.category);
    // 跳过没有分类的记录
    if (!categoryKey) {
      console.warn(`跳过没有分类的海报: ${poster.id} - ${poster.title}`);
      return;
    }
    
    if (!postersByCategory[categoryKey]) {
      postersByCategory[categoryKey] = [];
    }
    // 确保URL是正确的
    postersByCategory[categoryKey].push(fixPosterUrl(poster));
  });
  
  const categories: Record<string, { count: number; pages: number }> = {};
  
  // 为每个分类生成分页数据并存储到KV
  for (const [categoryKey, posters] of Object.entries(postersByCategory)) {
    console.log(`处理分类: ${categoryKey}, 共 ${posters.length} 条记录`);
    
    const totalPages = Math.ceil(posters.length / POSTERS_PER_PAGE);
    categories[categoryKey] = { count: posters.length, pages: totalPages };
    
    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * POSTERS_PER_PAGE;
      const end = start + POSTERS_PER_PAGE;
      const pagePosters = posters.slice(start, end);
      
      // 生成KV键名
      const kvKey = `EXPORT_${categoryKey}_${page}`;
      
      // 存储到KV
      await env.POSTER_METADATA.put(kvKey, JSON.stringify(pagePosters));
      
      console.log(`  存储到KV: ${kvKey} (${pagePosters.length} 条记录)`);
    }
  }
  
  // 存储元数据
  const metadata = {
    exportTime: new Date().toISOString(),
    totalPosters: allPosters.length,
    categories,
    postersPerPage: POSTERS_PER_PAGE,
    categoryMapping: CATEGORY_MAPPING
  };
  
  await env.POSTER_METADATA.put('EXPORT_METADATA', JSON.stringify(metadata));
  
  console.log('分类分页数据导出到KV完成！');
  
  return {
    totalPosters: allPosters.length,
    categories
  };
}

/**
 * 从KV读取导出的分类分页数据，如果没有则直接从数据库查询
 */
export async function getExportedCategoryData(
  env: Env, 
  category: string, 
  page: number
): Promise<PosterMetadata[] | null> {
  // 首先尝试从KV读取导出的数据
  const categoryKey = getCategoryKey(category);
  const kvKey = `EXPORT_${categoryKey}_${page}`;
  
  const kvData = await env.POSTER_METADATA.get(kvKey);
  if (kvData) {
    try {
      return JSON.parse(kvData) as PosterMetadata[];
    } catch (e) {
      console.error(`解析导出的分类数据失败: ${kvKey}`, e);
      // 如果解析失败，继续执行回退逻辑
    }
  }
  
  // 回退方案：直接从数据库查询
  console.log(`KV中没有找到 ${kvKey}，从数据库直接查询`);
  
  // 反向映射：从英文键名找到中文分类名
  const reverseCategoryMapping = Object.fromEntries(
    Object.entries(CATEGORY_MAPPING).map(([chinese, english]) => [english, chinese])
  );
  
  const chineseCategoryName = reverseCategoryMapping[categoryKey] || categoryKey;
  
  // 获取所有海报数据
  const allPosters = await getAllPosterMetadataWithoutPagination(env);
  
  // 过滤指定分类的海报
  const categoryPosters = allPosters
    .filter(poster => poster.category === chineseCategoryName)
    .map(poster => fixPosterUrl(poster));
  
  // 分页
  const start = (page - 1) * POSTERS_PER_PAGE;
  const end = start + POSTERS_PER_PAGE;
  const pagePosters = categoryPosters.slice(start, end);
  
  return pagePosters.length > 0 ? pagePosters : null;
}

/**
 * 获取导出元数据
 */
export async function getExportMetadata(env: Env): Promise<any> {
  const metadata = await env.POSTER_METADATA.get('EXPORT_METADATA');
  if (!metadata) {
    return null;
  }
  
  try {
    return JSON.parse(metadata);
  } catch (e) {
    console.error('解析导出元数据失败', e);
    return null;
  }
}

/**
 * 清理导出的数据
 */
export async function clearExportedData(env: Env): Promise<void> {
  console.log('开始清理导出的数据...');
  
  const listResult = await env.POSTER_METADATA.list({ prefix: 'EXPORT_' });
  const deletePromises: Promise<void>[] = [];
  
  for (const key of listResult.keys) {
    deletePromises.push(env.POSTER_METADATA.delete(key.name));
  }
  
  if (deletePromises.length > 0) {
    await Promise.all(deletePromises);
    console.log(`清理了 ${deletePromises.length} 个导出的数据条目`);
  } else {
    console.log('没有找到需要清理的导出数据');
  }
}

/**
 * 生成前端可用的JSON数据（用于静态文件）
 */
export async function generateStaticJSONData(env: Env): Promise<Record<string, Record<number, PosterMetadata[]>>> {
  console.log('开始生成静态JSON数据...');
  
  const allPosters = await getAllPosterMetadataWithoutPagination(env);
  const postersByCategory: Record<string, PosterMetadata[]> = {};
  
  // 按分类分组
  allPosters.forEach(poster => {
    const categoryKey = getCategoryKey(poster.category);
    // 跳过没有分类的记录
    if (!categoryKey) {
      console.warn(`跳过没有分类的海报: ${poster.id} - ${poster.title}`);
      return;
    }
    
    if (!postersByCategory[categoryKey]) {
      postersByCategory[categoryKey] = [];
    }
    postersByCategory[categoryKey].push(fixPosterUrl(poster));
  });
  
  const result: Record<string, Record<number, PosterMetadata[]>> = {};
  
  // 为每个分类进行分页
  for (const [categoryKey, posters] of Object.entries(postersByCategory)) {
    result[categoryKey] = {};
    const totalPages = Math.ceil(posters.length / POSTERS_PER_PAGE);
    
    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * POSTERS_PER_PAGE;
      const end = start + POSTERS_PER_PAGE;
      const pagePosters = posters.slice(start, end);
      result[categoryKey][page] = pagePosters;
    }
  }
  
  console.log('静态JSON数据生成完成');
  return result;
} 