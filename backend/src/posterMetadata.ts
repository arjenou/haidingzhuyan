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

/**
 * 获取所有海报元数据
 */
export async function getAllPosterMetadata(env: Env): Promise<PosterMetadata[]> {
  const listResult = await env.POSTER_METADATA.list();
  const posters: PosterMetadata[] = [];

  for (const key of listResult.keys) {
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
  return posters.sort((a, b) => b.updatedAt - a.updatedAt);
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

  await env.POSTER_METADATA.put(id, JSON.stringify(metadata));
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

  await env.POSTER_METADATA.put(id, JSON.stringify(updated));
  return updated;
}

/**
 * 删除海报元数据
 */
export async function deletePosterMetadata(env: Env, id: string): Promise<boolean> {
  const existing = await getPosterMetadata(env, id);
  if (!existing) return false;

  await env.POSTER_METADATA.delete(id);
  return true;
}

/**
 * 获取所有分类
 */
export async function getAllCategories(env: Env): Promise<string[]> {
  const posters = await getAllPosterMetadata(env);
  const categories = new Set<string>();
  
  posters.forEach(poster => {
    if (poster.category) {
      categories.add(poster.category);
    }
  });
  
  return Array.from(categories);
} 