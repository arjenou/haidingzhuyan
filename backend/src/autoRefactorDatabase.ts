import { Env } from './config';
import { updateCategoryData } from './posterMetadata';

/**
 * 自动重构数据库，初始化分类数据
 */
export async function autoRefactorDatabase(env: Env): Promise<void> {
  try {
    console.log('开始初始化分类数据...');
    await updateCategoryData(env);
    console.log('分类数据初始化完成');
  } catch (error) {
    console.error('初始化分类数据失败:', error);
    throw error;
  }
} 