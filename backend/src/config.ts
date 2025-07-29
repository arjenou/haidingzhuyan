// 配置信息
export const config = {
  r2: {
    bucket: 'haidingzhuyan',
    endpoint: 'https://2e9ce2c37b30771ddabc7503e02c4c3.r2.cloudflarestorage.com'
  }
};

// 环境类型定义，让TypeScript能识别Cloudflare环境变量
export interface Env {
  R2_BUCKET: R2Bucket;
  R2_ENDPOINT: string;
  POSTER_METADATA: KVNamespace;
  POSTER_METADATA_PAGES: KVNamespace;
  SEARCH_INDEX: KVNamespace;
} 