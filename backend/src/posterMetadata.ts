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
const POSTERS_PER_PAGE = 20; // 每页显示的海报数量

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
    return JSON.parse(indexData) as PosterMetadata[];
  } catch (e) {
    console.error(`解析索引数据失败，尝试重建索引: ${indexKey}`, e);
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
  
  return sortedPosters;
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
 * 根据ID获取海报元数据
 */
export async function getPosterMetadata(env: Env, id: string): Promise<PosterMetadata | null> {
  const data = await env.POSTER_METADATA.get(id);
  if (!data) return null;

  try {
    return JSON.parse(data) as PosterMetadata;
  } catch (e) {
    console.error(`无法解析海报数据: ${id}`, e);
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

  // 更新索引
  const posters = await getPosterMetadataFromIndex(env, 1);
  posters.unshift(metadata); // 添加到数组开头
  await updatePosterMetadataIndex(env, posters);

  return metadata;
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

  // 更新索引
  const posters = await getPosterMetadataFromIndex(env, 1);
  const index = posters.findIndex(p => p.id === id);
  if (index !== -1) {
    posters[index] = updated;
    // 重新排序
    posters.sort((a, b) => b.updatedAt - a.updatedAt);
    await updatePosterMetadataIndex(env, posters);
  }

  return updated;
}

/**
 * 删除海报元数据
 */
export async function deletePosterMetadata(env: Env, id: string): Promise<boolean> {
  const existing = await getPosterMetadata(env, id);
  if (!existing) return false;

  // 删除元数据
  await env.POSTER_METADATA.delete(id);

  // 更新索引
  const posters = await getPosterMetadataFromIndex(env, 1);
  const filteredPosters = posters.filter(p => p.id !== id);
  await updatePosterMetadataIndex(env, filteredPosters);

  return true;
}

/**
 * 获取所有分类
 */
export async function getAllCategories(env: Env): Promise<string[]> {
  const { posters } = await getAllPosterMetadata(env, 1);
  const categories = new Set<string>();
  posters.forEach((poster) => {
    if (poster.category) {
      categories.add(poster.category);
    }
  });
  return Array.from(categories);
} 