import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPosterMetadataByCategory } from '../services/posterMetadataService';
import type { PosterMetadata } from '../services/posterMetadataService';
import { useDebounce } from '../hooks/useDebounce';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787/api';

// 中文分类到后端API Key的映射
const categoryNameToKeyMap: { [key: string]: string } = {
  '工科': 'gongke',
  '文科': 'wenke',
  '商科': 'shangke',
  '理科': 'like',
};

type SearchIndexItem = Omit<PosterMetadata, 'createdAt' | 'updatedAt'>;

const ProjectListPage: React.FC = () => {
  const { subject } = useParams<{ subject: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // 300ms 防抖

  // 状态
  const [selectedCategory, setSelectedCategory] = useState(subject || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 分页浏览的状态
  const [posters, setPosters] = useState<PosterMetadata[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 客户端搜索的状态
  const [searchIndex, setSearchIndex] = useState<SearchIndexItem[]>([]);
  const [searchResults, setSearchResults] = useState<SearchIndexItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 弹窗状态
  const [showPoster, setShowPoster] = useState(false);
  const [currentPoster, setCurrentPoster] = useState<PosterMetadata | SearchIndexItem | null>(null);

  // 无限滚动配置
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // 监听 URL 参数变化
  useEffect(() => {
    if (subject) {
      setSelectedCategory(subject);
      // 重置所有状态
      setSearchQuery('');
      setCurrentPage(1);
      setPosters([]);
      setHasMore(true);
      setSearchIndex([]);
      setSearchResults([]);
    }
  }, [subject]);

  // 获取分页数据和搜索索引
  useEffect(() => {
    const categoryKey = categoryNameToKeyMap[selectedCategory] || selectedCategory;
    if (!categoryKey) return;

    // 1. 获取第一页数据
    const fetchFirstPage = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await getPosterMetadataByCategory(categoryKey, 1);
        setPosters(result.posters);
        setCurrentPage(1);
        setHasMore(result.hasMore);
      } catch (err) {
        console.error('加载第一页数据失败:', err);
        setError('加载数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    // 2. 获取搜索索引文件
    const fetchSearchIndex = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/search-index/${categoryKey}`);
        if (!response.ok) {
          throw new Error(`搜索索引文件未找到: ${response.statusText}`);
        }
        const indexData: SearchIndexItem[] = await response.json();
        setSearchIndex(indexData);
      } catch (err) {
        console.warn('加载搜索索引失败:', err);
        // 加载失败不影响浏览，仅搜索功能受限
      }
    };

    fetchFirstPage();
    fetchSearchIndex();
  }, [selectedCategory]);

  // 监听搜索词变化，执行客户端搜索
  useEffect(() => {
    if (debouncedSearchQuery) {
      setIsSearching(true);
      const lowerCaseQuery = debouncedSearchQuery.toLowerCase();
      const results = searchIndex.filter(item => {
        const titleMatches = item.title.toLowerCase().includes(lowerCaseQuery);
        const descriptionMatches = item.description.toLowerCase().includes(lowerCaseQuery);
        const targetAudienceMatches = item.targetAudience && item.targetAudience.some(audience =>
          audience.toLowerCase().includes(lowerCaseQuery)
        );
        return titleMatches || descriptionMatches || targetAudienceMatches;
      });
      setSearchResults(results);
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, searchIndex]);

  // 加载更多（仅在非搜索模式下）
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !selectedCategory || isSearching) return;

    setIsLoadingMore(true);
    
    const categoryKey = categoryNameToKeyMap[selectedCategory] || selectedCategory;

    try {
      const nextPage = currentPage + 1;
      const result = await getPosterMetadataByCategory(categoryKey, nextPage);
      
      setPosters(prev => [...prev, ...result.posters]);
      setCurrentPage(nextPage);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('加载更多数据失败:', err);
      setError('加载更多数据失败，请稍后重试');
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentPage, selectedCategory, isLoadingMore, hasMore, isSearching]);

  // 设置无限滚动观察器
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, hasMore, isLoadingMore]);

  const handleShowPoster = (poster: PosterMetadata | SearchIndexItem) => {
    setCurrentPoster(poster);
    setShowPoster(true);
  };

  const handleCloseModal = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowPoster(false);
    }
  };

  const displayedItems = isSearching ? searchResults : posters;

  return (
    <>
      {/* 顶部搜索栏 */}
      <div className="bg-white shadow-sm py-4 px-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="text-gray-600 hover:text-gray-800 mr-4"
          >
            <span className="text-xl">←</span>
          </button>
          <form onSubmit={(e) => e.preventDefault()} className="flex-1">
            <div className="relative">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base"
                placeholder="请输入项目名称/适合专业/项目关键词"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="text-lg">🔍</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <svg className="animate-spin h-8 w-8 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-md">
            {error}
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {isSearching ? '没有找到符合条件的搜索结果' : '没有找到符合条件的海报'}
          </div>
        ) : (
          <>
            {/* 项目卡片 */}
            {displayedItems.map((poster) => (
              <div key={poster.id} className="mb-12 border-b pb-8 last:border-b-0 last:pb-0">
                <div className="flex flex-row gap-4 items-start">
                  {/* 海报图片 - 固定宽度 */}
                  <div className="min-w-[120px] w-[120px]">
                    <div className="relative overflow-hidden rounded-lg shadow-md w-full aspect-[3/4] bg-white">
                      <img
                        src={poster.imageUrl}
                        alt={poster.title}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-transparent p-2">
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleShowPoster(poster)}
                            className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-2 py-1 rounded cursor-pointer transition-colors flex items-center justify-center gap-1"
                          >
                            <span className="text-white text-xs">⚡</span>
                            <span>查看</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 右侧内容区 */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    {/* 标题固定为两行高度 */}
                    <div className="min-h-[3rem] mb-3">
                      <h2 className="text-base font-bold text-gray-800 leading-tight line-clamp-2">{poster.title}</h2>
                    </div>
                    <div className="mb-2">
                      <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {poster.category}
                      </span>
                    </div>
                    {/* 适合人群标签 */}
                    {poster.targetAudience && poster.targetAudience.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {poster.targetAudience.map((audience, index) => (
                          <span
                            key={index}
                            className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded"
                          >
                            {audience}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* 无限滚动加载指示器 (仅在非搜索模式下显示) */}
            {!isSearching && hasMore && (
              <div 
                ref={loadingRef} 
                style={{ minHeight: '1px' }}
                className="flex justify-center py-8" 
              >
                {isLoadingMore ? (
                  <div className="flex items-center space-x-2">
                    <svg className="animate-spin h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-gray-600">加载中...</span>
                  </div>
                ) : (
                  <button
                    onClick={loadMore}
                    className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors font-medium"
                  >
                    加载更多
                  </button>
                )}
              </div>
            )}
            
            {/* 没有更多数据提示 (根据模式显示不同文本) */}
            {!isSearching && !hasMore && posters.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>已显示所有内容</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 海报弹窗 */}
      {showPoster && currentPoster && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 p-4"
          onClick={handleCloseModal}
        >
          <div className="relative max-w-3xl w-full h-full flex items-center justify-center animate-fade-in-up">
            <img 
              src={currentPoster.imageUrl} 
              alt={currentPoster.title} 
              className="block max-w-full max-h-full h-auto w-auto rounded-lg shadow-2xl"
            />
              <button
                onClick={() => setShowPoster(false)}
              className="absolute top-0 right-0 m-4 text-white bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-opacity z-10"
              >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectListPage; 