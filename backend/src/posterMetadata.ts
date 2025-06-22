import { Env } from './config';

/**
 * 海报元数据接口
 */
export interface PosterMetadata {
  id: string;
  title: string;
  description: string;
  category: string;
  targetAudience: string[];
  imageKey: string; // R2中存储的图片Key
  imageUrl: string; // 图片访问URL
  createdAt: number;
  updatedAt: number;
}

/**
 * 创建/更新海报元数据的输入接口
 */
export interface PosterMetadataInput {
  title: string;
  description?: string;
  category: string;
  targetAudience?: string[];
  imageKey: string;
  imageUrl: string;
}

// 索引键名常量
const POSTER_METADATA_INDEX_PREFIX = 'POSTER_METADATA_INDEX_';
const POSTER_METADATA_COUNT = 'POSTER_METADATA_COUNT';
// 5分钟的缓存时间
const CACHE_TTL_MS = 5 * 60 * 1000;
let allPostersCache: PosterMetadata[] | null = null;
let cacheTimestamp = 0;

/**
 * 动态修复海报的图片URL，将旧的workers.dev域名替换为新的自定义域名。
 * 这是一个防御性措施，确保无论数据库中存储的是什么，返回给客户端的总是正确的URL。
 */
export function fixPosterUrl<T extends { imageUrl?: string | null }>(poster: T): T {
  if (!poster.imageUrl) {
    return poster;
  }
  const oldDomain = 'xinhangdao-api.wangyunjie1101.workers.dev';
  const newDomain = 'api.capstoneketi.com';
  
  // 同时处理带协议和不带协议的域名
  if (poster.imageUrl.includes(oldDomain)) {
    const url = new URL(poster.imageUrl);
    if (url.hostname === oldDomain) {
      url.hostname = newDomain;
      return {
        ...poster,
        imageUrl: url.toString()
      };
    }
  }
  return poster;
}

function invalidateCache() {
  allPostersCache = null;
  cacheTimestamp = 0;
  console.log('内存缓存已清除');
}

const POSTERS_PER_PAGE = 10; // 每页显示的海报数量

/**
 * 获取分页索引键名
 */
function getIndexKey(page: number): string {
  return `${POSTER_METADATA_INDEX_PREFIX}${page}`;
}

/**
 * 获取总页数
 */
async function getTotalPages(env: Env): Promise<number> {
  const countStr = await env.POSTER_METADATA.get(POSTER_METADATA_COUNT);
  const count = countStr ? parseInt(countStr, 10) : 0;
  return Math.ceil(count / POSTERS_PER_PAGE);
}

/**
 * 更新总数量
 */
async function updateTotalCount(env: Env, count: number): Promise<void> {
  await env.POSTER_METADATA.put(POSTER_METADATA_COUNT, count.toString());
}

/**
 * 从索引中获取指定页的海报元数据
 */
async function getPosterMetadataFromIndex(env: Env, page: number = 1): Promise<PosterMetadata[]> {
  const indexKey = getIndexKey(page);
  const indexData = await env.POSTER_METADATA.get(indexKey);
  
  if (!indexData) {
    // 如果索引不存在，从KV中重建索引
    return await rebuildPosterMetadataIndex(env);
  }

  try {
    const posters = JSON.parse(indexData) as PosterMetadata[];
    return posters.map(fixPosterUrl);
  } catch (e) {
    console.error(`解析索引数据失败，尝试重建索引: ${indexKey}`, e);
    // 重建索引时也会自动修复URL
    return await rebuildPosterMetadataIndex(env);
  }
}

/**
 * 重建海报元数据索引
 */
async function rebuildPosterMetadataIndex(env: Env): Promise<PosterMetadata[]> {
  const listResult = await env.POSTER_METADATA.list();
  const posters: PosterMetadata[] = [];

  for (const key of listResult.keys) {
    if (key.name.startsWith(POSTER_METADATA_INDEX_PREFIX) || key.name === POSTER_METADATA_COUNT) {
      continue;
    }
    
    const posterJson = await env.POSTER_METADATA.get(key.name);
    if (posterJson) {
      try {
        const poster = JSON.parse(posterJson) as PosterMetadata;
        posters.push(poster);
      } catch (e) {
        console.error(`无法解析海报数据: ${key.name}`, e);
      }
    }
  }

  // 按更新时间排序（最新的在前面）
  const sortedPosters = posters.sort((a, b) => b.updatedAt - a.updatedAt);
  
  // 更新总数量
  await updateTotalCount(env, sortedPosters.length);
  
  // 分页存储
  const totalPages = Math.ceil(sortedPosters.length / POSTERS_PER_PAGE);
  for (let i = 0; i < totalPages; i++) {
    const start = i * POSTERS_PER_PAGE;
    const end = start + POSTERS_PER_PAGE;
    const pagePosters = sortedPosters.slice(start, end);
    await env.POSTER_METADATA.put(getIndexKey(i + 1), JSON.stringify(pagePosters));
  }
  
  // 返回时，确保URL是修复过的
  return sortedPosters.map(fixPosterUrl);
}

/**
 * 更新海报元数据索引
 */
async function updatePosterMetadataIndex(env: Env, posters: PosterMetadata[]): Promise<void> {
  try {
    // 更新总数量
    await updateTotalCount(env, posters.length);
    
    // 分页存储
    const totalPages = Math.ceil(posters.length / POSTERS_PER_PAGE);
    for (let i = 0; i < totalPages; i++) {
      const start = i * POSTERS_PER_PAGE;
      const end = start + POSTERS_PER_PAGE;
      const pagePosters = posters.slice(start, end);
      await env.POSTER_METADATA.put(getIndexKey(i + 1), JSON.stringify(pagePosters));
    }
  } catch (e) {
    console.error('更新索引失败', e);
    // 如果更新失败，尝试重建索引
    await rebuildPosterMetadataIndex(env);
  }
}

/**
 * 获取所有海报元数据（分页）
 */
export async function getAllPosterMetadata(env: Env, page: number = 1): Promise<{
  posters: PosterMetadata[];
  totalPages: number;
  currentPage: number;
}> {
  const posters = await getPosterMetadataFromIndex(env, page);
  const totalPages = await getTotalPages(env);
  
  return {
    posters,
    totalPages,
    currentPage: page
  };
}

/**
 * 获取所有海报元数据（不分页，用于无限滚动）
 */
export async function getAllPosterMetadataWithoutPagination(env: Env): Promise<PosterMetadata[]> {
  const now = Date.now();
  if (allPostersCache && now - cacheTimestamp < CACHE_TTL_MS) {
    console.log('正在从内存缓存提供所有海报');
    return allPostersCache.map(fixPosterUrl);
  }

  console.log('缓存未命中或已过期，从KV获取所有海报');
  const listResult = await env.POSTER_METADATA.list();
  const posters: PosterMetadata[] = [];

  for (const key of listResult.keys) {
    // 忽略所有索引和分类缓存键
    if (key.name.startsWith(POSTER_METADATA_INDEX_PREFIX) || 
        key.name.startsWith('CATEGORY_DATA_') || 
        key.name === POSTER_METADATA_COUNT) {
      continue;
    }
    
    const posterJson = await env.POSTER_METADATA.get(key.name);
    if (posterJson) {
      try {
        const poster = JSON.parse(posterJson) as PosterMetadata;
        posters.push(poster);
      } catch (e) {
        console.error(`无法解析海报数据: ${key.name}`, e);
      }
    }
  }

  // 按更新时间排序（最新的在前面）
  const sortedPosters = posters.sort((a, b) => b.updatedAt - a.updatedAt);

  // 存入缓存的是原始数据，但在返回时修复URL
  allPostersCache = [...sortedPosters];
  cacheTimestamp = now;
  
  return sortedPosters.map(fixPosterUrl);
}

/**
 * 根据ID获取海报元数据
 */
export async function getPosterMetadata(env: Env, id: string): Promise<PosterMetadata | null> {
  const data = await env.POSTER_METADATA.get(id);
  if (!data) return null;

  try {
    const poster = JSON.parse(data) as PosterMetadata;
    return fixPosterUrl(poster);
  } catch (e) {
    console.error(`解析海报数据失败: ${id}`, e);
    return null;
  }
}

/**
 * 创建新的海报元数据
 */
export async function createPosterMetadata(
  env: Env, 
  input: PosterMetadataInput
): Promise<PosterMetadata> {
  const id = `poster_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();

  const metadata: PosterMetadata = {
    id,
    title: input.title,
    description: input.description || '',
    category: input.category,
    targetAudience: input.targetAudience || [],
    imageKey: input.imageKey,
    imageUrl: input.imageUrl,
    createdAt: now,
    updatedAt: now
  };

  // 保存元数据
  await env.POSTER_METADATA.put(id, JSON.stringify(metadata));

  // 更新索引和缓存
  await rebuildAndCacheAllPosterMetadata(env);
  await generateAndStoreSearchIndexes(env); // 重新生成搜索索引

  // 更新分类数据
  await updateCategoryData(env);

  return fixPosterUrl(metadata);
}

/**
 * 更新海报元数据
 */
export async function updatePosterMetadata(
  env: Env,
  id: string,
  input: Partial<PosterMetadataInput>
): Promise<PosterMetadata | null> {
  const existing = await getPosterMetadata(env, id);
  if (!existing) return null;

  const updated: PosterMetadata = {
    ...existing,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.targetAudience !== undefined && { targetAudience: input.targetAudience }),
    ...(input.imageKey !== undefined && { imageKey: input.imageKey }),
    ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
    updatedAt: Date.now()
  };

  // 保存更新后的元数据
  await env.POSTER_METADATA.put(id, JSON.stringify(updated));

  // 更新索引和缓存
  await rebuildAndCacheAllPosterMetadata(env);
  await generateAndStoreSearchIndexes(env); // 重新生成搜索索引

  // 更新分类数据
  await updateCategoryData(env);

  return fixPosterUrl(updated);
}

/**
 * 删除海报元数据
 */
export async function deletePosterMetadata(env: Env, id: string): Promise<boolean> {
  const existing = await getPosterMetadata(env, id);
  if (!existing) return false;

  // 删除元数据
  await env.POSTER_METADATA.delete(id);

  // 更新索引和缓存
  await rebuildAndCacheAllPosterMetadata(env);
  await generateAndStoreSearchIndexes(env); // 重新生成搜索索引
  
  // 更新分类数据
  await updateCategoryData(env);

  return true;
}

/**
 * 重建并缓存所有海报元数据
 * 这个函数将取代旧的 updatePosterMetadataIndex
 */
async function rebuildAndCacheAllPosterMetadata(env: Env): Promise<void> {
  invalidateCache(); // 清除缓存

  console.log('正在重建并缓存所有海报元数据');
  // 获取所有海报（这将重新从KV加载并填充缓存）
  const allPosters = await getAllPosterMetadataWithoutPagination(env);

  // 更新总数量
  const totalCount = allPosters.length;
  await env.POSTER_METADATA.put(POSTER_METADATA_COUNT, totalCount.toString());
  
  // 分页存储旧的索引（可选，为了兼容性）
  const totalPages = Math.ceil(totalCount / POSTERS_PER_PAGE);
  for (let i = 0; i < totalPages; i++) {
    const start = i * POSTERS_PER_PAGE;
    const end = start + POSTERS_PER_PAGE;
    const pagePosters = allPosters.slice(start, end);
    await env.POSTER_METADATA.put(`${POSTER_METADATA_INDEX_PREFIX}${i + 1}`, JSON.stringify(pagePosters));
  }
}

/**
 * 生成并存储所有分类的搜索索引
 */
export async function generateAndStoreSearchIndexes(env: Env): Promise<Record<string, { count: number; url: string }>> {
  console.log('开始生成和存储搜索索引...');
  const allPosters = await getAllPosterMetadataWithoutPagination(env);

  const postersByCategory: Record<string, PosterMetadata[]> = {};

  // 1. 按分类分组
  allPosters.forEach(poster => {
    const categoryKey = getCategoryKey(poster.category);
    if (!postersByCategory[categoryKey]) {
      postersByCategory[categoryKey] = [];
    }
    postersByCategory[categoryKey].push(poster);
  });

  const uploadResults: Record<string, { count: number; url: string }> = {};

  // 2. 为每个分类生成并上传索引文件
  for (const categoryKey in postersByCategory) {
    const posters = postersByCategory[categoryKey];
    
    // 创建一个只包含搜索所需字段的简化列表
    const searchIndex = posters.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      category: p.category,
      targetAudience: p.targetAudience,
      imageUrl: p.imageUrl, // 包含图片URL以便在搜索结果中显示
    }));

    const fileName = `search-indexes/${categoryKey}.json`;
    const fileContent = JSON.stringify(searchIndex, null, 2);

    // 上传到R2
    await env.R2_BUCKET.put(fileName, fileContent, {
      httpMetadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=3600', // 缓存1小时
      },
    });

    // 假设的R2公开访问URL，你需要根据你的配置修改
    const publicUrl = `https://pub-454553535914434791035978f83694f4.r2.dev/${fileName}`;
    uploadResults[categoryKey] = {
      count: searchIndex.length,
      url: publicUrl,
    };
    console.log(`已上传索引: ${fileName}, 包含 ${searchIndex.length} 条记录`);
  }
  
  console.log('所有搜索索引已生成和存储完毕。');
  return uploadResults;
}

// 辅助函数，将中文分类映射到文件名
function getCategoryKey(categoryName: string): string {
  const map: { [key: string]: string } = {
    '工科': 'gongke',
    '文科': 'wenke',
    '商科': 'shangke_business',
    '理科': 'like',
  };
  return map[categoryName] || categoryName.toLowerCase().replace(/\s+/g, '-');
}

/**
 * 获取所有分类
 */
export async function getAllCategories(env: Env): Promise<string[]> {
  const posters = await getAllPosterMetadataWithoutPagination(env);
  const categories = new Set<string>();
  posters.forEach((poster) => {
    if (poster.category) {
      categories.add(poster.category);
    }
  });
  return Array.from(categories);
}

/**
 * 根据分类获取海报元数据（分页）
 */
export async function getPosterMetadataByCategory(
  env: Env, 
  category: string, 
  page: number = 1,
  searchQuery?: string
): Promise<{
  posters: PosterMetadata[];
  totalPages: number;
  currentPage: number;
  hasMore: boolean;
}> {
  // 如果有搜索词，则绕过缓存，执行实时搜索
  if (searchQuery && searchQuery.trim() !== '') {
    const allPosters = await getAllPosterMetadataWithoutPagination(env);

    const categoryPosters = allPosters.filter(p => p.category === category);

    const lowerCaseQuery = searchQuery.toLowerCase();
    const filteredPosters = categoryPosters.filter(poster => {
      const titleMatches = poster.title.toLowerCase().includes(lowerCaseQuery);
      const descriptionMatches = poster.description.toLowerCase().includes(lowerCaseQuery);
      const targetAudienceMatches = poster.targetAudience && poster.targetAudience.some(audience =>
        audience.toLowerCase().includes(lowerCaseQuery)
      );
      return titleMatches || descriptionMatches || targetAudienceMatches;
    });

    // 对搜索结果进行分页
    const totalPages = Math.ceil(filteredPosters.length / POSTERS_PER_PAGE);
    const start = (page - 1) * POSTERS_PER_PAGE;
    const end = start + POSTERS_PER_PAGE;
    const pagePosters = filteredPosters.slice(start, end);

    return {
      posters: pagePosters,
      totalPages: totalPages,
      currentPage: page,
      hasMore: page < totalPages,
    };
  }

  // 没有搜索词时，使用缓存
  const categoryKey = `CATEGORY_DATA_${category}_${page}`;
  const categoryData = await env.POSTER_METADATA.get(categoryKey);
  
  if (!categoryData) {
    // 如果分类数据不存在，需要生成
    await generateCategoryData(env, category);
    // 重新获取
    const regeneratedData = await env.POSTER_METADATA.get(categoryKey);
    if (!regeneratedData) {
      return {
        posters: [],
        totalPages: 0,
        currentPage: page,
        hasMore: false
      };
    }
    
    try {
      const data = JSON.parse(regeneratedData);
      return {
        posters: (data.posters || []).map(fixPosterUrl),
        totalPages: data.totalPages || 0,
        currentPage: page,
        hasMore: data.hasMore || false
      };
    } catch (e) {
      console.error(`解析分类数据失败: ${categoryKey}`, e);
      return {
        posters: [],
        totalPages: 0,
        currentPage: page,
        hasMore: false
      };
    }
  }

  try {
    const data = JSON.parse(categoryData);
    // 兼容旧数据格式的 'records' 和新格式的 'posters'
    const postersList = data.posters || data.records || [];
    const totalPages = data.totalPages || 0;

    // 健壮地计算 hasMore，兼容缺少该字段的旧缓存数据
    const hasMore = typeof data.hasMore === 'boolean' 
      ? data.hasMore 
      : page < totalPages;

    return {
      posters: postersList.map(fixPosterUrl),
      totalPages: totalPages,
      currentPage: page,
      hasMore: hasMore,
    };
  } catch (e) {
    console.error(`解析分类数据失败: ${categoryKey}`, e);
    return {
      posters: [],
      totalPages: 0,
      currentPage: page,
      hasMore: false
    };
  }
}

/**
 * 生成分类数据
 */
async function generateCategoryData(env: Env, category: string): Promise<void> {
  // 获取所有海报
  const allPosters = await getAllPosterMetadataWithoutPagination(env);
  
  // 按分类筛选
  const categoryPosters = allPosters.filter(poster => poster.category === category);
  
  // 分页存储
  const totalPages = Math.ceil(categoryPosters.length / POSTERS_PER_PAGE);
  
  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * POSTERS_PER_PAGE;
    const end = start + POSTERS_PER_PAGE;
    const pagePosters = categoryPosters.slice(start, end);
    
    const categoryKey = `CATEGORY_DATA_${category}_${page}`;
    const data = {
      posters: pagePosters,
      totalPages,
      currentPage: page,
      hasMore: page < totalPages
    };
    
    await env.POSTER_METADATA.put(categoryKey, JSON.stringify(data));
  }
}
/**
 * 更新分类数据（当海报数据发生变化时调用）
 */
export async function updateCategoryData(env: Env): Promise<void> {
  // 获取所有分类
  const allPosters = await getAllPosterMetadataWithoutPagination(env);
  const categories = new Set<string>();
  allPosters.forEach(poster => {
    if (poster.category) {
      categories.add(poster.category);
    }
  });
  
  // 为每个分类重新生成数据
  for (const category of categories) {
    await generateCategoryData(env, category);
  }
}

// 新增：一次性迁移所有海报的图片URL
export async function migrateImageUrls(env: Env): Promise<{ total: number; migrated: number; errors: number; }> {
  console.log('开始迁移图片URL...');
  // 强制清除内存缓存，确保从KV获取最新数据
  invalidateCache();
  const allPosters = await getAllPosterMetadataWithoutPagination(env);

  const stats = {
    total: allPosters.length,
    migrated: 0,
    errors: 0,
  };

  const oldDomain = 'xinhangdao-api.wangyunjie1101.workers.dev';
  const newDomain = 'api.capstoneketi.com';

  for (const poster of allPosters) {
    try {
      if (poster.imageUrl && poster.imageUrl.includes(oldDomain)) {
        const url = new URL(poster.imageUrl);
        if (url.hostname === oldDomain) {
          url.hostname = newDomain;
          const updatedPoster = { ...poster, imageUrl: url.toString() };

          // 保存更新后的元数据
          await env.POSTER_METADATA.put(poster.id, JSON.stringify(updatedPoster));
          stats.migrated++;
        }
      }
    } catch (e) {
      console.error(`迁移海报 ${poster.id} 失败:`, e);
      stats.errors++;
    }
  }

  // 迁移完成后，清除所有内存和KV缓存以强制重新加载
  invalidateCache();
  await clearAllCategoryCache(env);
  
  console.log(`URL迁移完成: 共计 ${stats.total}, 成功迁移 ${stats.migrated}, 失败 ${stats.errors}`);
  return stats;
}

async function clearAllCategoryCache(env: Env) {
  console.log('正在清除所有分类缓存...');
  const listResult = await env.POSTER_METADATA.list({ prefix: 'CATEGORY_DATA_' });
  const deletePromises: Promise<void>[] = [];
  for (const key of listResult.keys) {
    deletePromises.push(env.POSTER_METADATA.delete(key.name));
  }
  if (deletePromises.length > 0) {
    await Promise.all(deletePromises);
  }
  console.log(`清除了 ${deletePromises.length} 个分类缓存条目。`);
}

/**
 * 生成前端按分类和分页组织的数据
 */
export async function generateFrontendData(env: Env): Promise<Record<string, Record<number, PosterMetadata[]>>> {
  console.log('开始生成前端数据文件...');
  const allPosters = await getAllPosterMetadataWithoutPagination(env);

  const postersByCategory: Record<string, PosterMetadata[]> = {};

  // 1. 按分类分组
  allPosters.forEach(poster => {
    const categoryKey = getCategoryKey(poster.category);
    if (!postersByCategory[categoryKey]) {
      postersByCategory[categoryKey] = [];
    }
    // 返回前确保URL是正确的
    postersByCategory[categoryKey].push(fixPosterUrl(poster));
  });

  const frontendData: Record<string, Record<number, PosterMetadata[]>> = {};
  const POSTERS_PER_SUBJSON = 5;

  // 2. 为每个分类的数据进行分页
  for (const categoryKey in postersByCategory) {
    const categoryPosters = postersByCategory[categoryKey];
    frontendData[categoryKey] = {};

    const totalPages = Math.ceil(categoryPosters.length / POSTERS_PER_SUBJSON);
    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * POSTERS_PER_SUBJSON;
      const end = start + POSTERS_PER_SUBJSON;
      const pagePosters = categoryPosters.slice(start, end);
      frontendData[categoryKey][page] = pagePosters;
    }
  }

  console.log('前端数据文件生成完毕。');
  return frontendData;
} 