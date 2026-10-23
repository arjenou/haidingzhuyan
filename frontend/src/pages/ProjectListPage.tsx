import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { getPosterMetadataByCategory, posterThumbUrl, posterDisplayUrl, searchPosters } from '../services/posterMetadataService';
import type { PosterMetadata } from '../services/posterMetadataService';
import { useDebounce } from '../hooks/useDebounce';

// 中文分类到后端API Key的映射
const categoryNameToKeyMap: { [key: string]: string } = {
  '工科': 'gongke',
  '文科': 'wenke',
  '商科': 'shangke',
  '理科': 'like',
};

type SearchIndexItem = Omit<PosterMetadata, 'createdAt' | 'updatedAt'>;

/**
 * 列表只加载 360px 缩略图。按钮盖住图片，避免手机长按小图时存成屏幕截图。
 * 清晰图在「查看」里加载完成后才能保存。
 */
const PosterThumb: React.FC<{
  imageUrl: string;
  title: string;
  onOpen: () => void;
}> = ({ imageUrl, title, onOpen }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [useOriginal, setUseOriginal] = useState(false);
  const thumbnailUrl = posterThumbUrl(imageUrl);

  return (
    <div className="relative overflow-hidden rounded-lg shadow-md w-full aspect-[3/4] bg-gray-100">
      {imageUrl && status !== 'error' && (
        <img
          src={useOriginal ? imageUrl : thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setStatus('ready')}
          onError={() => {
            if (!useOriginal && thumbnailUrl !== imageUrl) {
              setUseOriginal(true);
              setStatus('loading');
            } else {
              setStatus('error');
            }
          }}
          className="w-full h-full object-contain bg-white pointer-events-none"
          style={{
            WebkitTouchCallout: 'none',
            opacity: status === 'ready' ? 1 : 0,
          }}
        />
      )}
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {status === 'error' || !imageUrl ? (
            <span className="text-xs text-gray-400 px-2 text-center">图片加载失败</span>
          ) : (
            <svg className="animate-spin h-6 w-6 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
        </div>
      )}
      <button
        type="button"
        className="absolute inset-0 z-[1] cursor-pointer"
        aria-label={`查看${title}`}
        onClick={onOpen}
        onContextMenu={(event) => event.preventDefault()}
        style={{ WebkitTouchCallout: 'none' }}
      />
      <div className="absolute bottom-0 left-0 right-0 z-[2] pointer-events-none bg-gradient-to-t from-gray-900 to-transparent p-2">
        <div className="flex justify-center">
          <span className="bg-amber-600 text-white text-xs px-2 py-1 rounded inline-flex items-center justify-center gap-1">
            <span className="text-white text-xs">⚡</span>
            <span>查看</span>
          </span>
        </div>
      </div>
    </div>
  );
};

const ProjectListPage: React.FC = () => {
  const { subject } = useParams<{ subject: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 200);

  // 状态
  const [selectedCategory, setSelectedCategory] = useState(subject || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 分页浏览的状态
  const [posters, setPosters] = useState<PosterMetadata[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 搜索走服务端，只拉命中的结果
  const [searchResults, setSearchResults] = useState<PosterMetadata[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const searchSeq = useRef(0);

  // 弹窗状态
  const [showPoster, setShowPoster] = useState(false);
  const [currentPoster, setCurrentPoster] = useState<PosterMetadata | SearchIndexItem | null>(null);
  const [posterStatus, setPosterStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [canSavePoster, setCanSavePoster] = useState(false);
  const [posterLoadAttempt, setPosterLoadAttempt] = useState(0);
  const [useOriginalPoster, setUseOriginalPoster] = useState(false);
  const posterImgRef = useRef<HTMLImageElement>(null);
  const posterImageUrl = currentPoster
    ? useOriginalPoster ? currentPoster.imageUrl : posterDisplayUrl(currentPoster.imageUrl)
    : '';

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
      setSearchResults([]);
      setSearchState('idle');
      searchSeq.current += 1;
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

    fetchFirstPage();
  }, [selectedCategory]);

  // 搜索不随当前学科限制，服务端在标题、简介、适合专业里匹配
  useEffect(() => {
    const q = debouncedSearchQuery.trim();
    const seq = ++searchSeq.current;
    if (!q) {
      setSearchResults([]);
      setSearchState('idle');
      return;
    }

    const controller = new AbortController();
    setSearchState('loading');
    setSearchResults([]);

    searchPosters(q, controller.signal)
      .then((posters) => {
        if (searchSeq.current !== seq) return;
        setSearchResults(posters);
        setSearchState('done');
      })
      .catch((err: unknown) => {
        if (searchSeq.current !== seq) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('搜索失败:', err);
        setSearchResults([]);
        setSearchState('error');
      });

    return () => controller.abort();
  }, [debouncedSearchQuery]);

  // 加载更多（仅在非搜索模式下）
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !selectedCategory || searchState !== 'idle') return;

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
  }, [currentPage, selectedCategory, isLoadingMore, hasMore, searchState]);

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
    setUseOriginalPoster(false);
    setPosterStatus(poster.imageUrl ? 'loading' : 'error');
    setCanSavePoster(false);
    setShowPoster(true);
  };

  const handleClosePoster = () => setShowPoster(false);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClosePoster();
  };

  useEffect(() => {
    if (!showPoster) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPoster]);

  useEffect(() => {
    if (!showPoster) return;
    const imageUrl = posterImageUrl;
    if (!imageUrl) return;

    let cancelled = false;
    setPosterStatus('loading');
    setCanSavePoster(false);

    const preload = new Image();
    preload.decoding = 'async';
    if ('fetchPriority' in preload) {
      preload.fetchPriority = 'high';
    }

    const finish = () => {
      if (cancelled) return;
      if (preload.naturalWidth > 0) setPosterStatus('ready');
      else setPosterStatus('error');
    };

    preload.onload = finish;
    preload.onerror = () => {
      if (cancelled) return;
      if (currentPoster && imageUrl !== currentPoster.imageUrl) {
        setUseOriginalPoster(true);
      } else {
        setPosterStatus('error');
      }
    };
    preload.src = imageUrl;
    if (preload.complete) finish();

    return () => {
      cancelled = true;
      preload.onload = null;
      preload.onerror = null;
    };
  }, [showPoster, currentPoster, posterImageUrl, posterLoadAttempt]);

  useEffect(() => {
    if (posterStatus !== 'ready') return;
    const el = posterImgRef.current;
    if (el?.complete && el.naturalWidth > 0) setCanSavePoster(true);
  }, [posterStatus, posterImageUrl]);

  const saveHint = posterStatus === 'error'
    ? '海报加载失败'
    : posterStatus !== 'ready' || !canSavePoster
      ? '海报加载中，完成前请不要保存'
      : '长按海报保存图片';

  const isSearching = searchState !== 'idle';
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
        ) : searchState === 'loading' ? (
          <div className="flex justify-center items-center gap-2 py-12 text-gray-500">
            <svg className="animate-spin h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>搜索中...</span>
          </div>
        ) : searchState === 'error' ? (
          <div className="text-center py-12 text-gray-500">搜索失败，请稍后重试</div>
        ) : displayedItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {isSearching ? '没有找到符合条件的搜索结果' : '没有找到符合条件的海报'}
          </div>
        ) : (
          <>
            {isSearching && searchResults.length >= 100 && (
              <p className="text-center text-sm text-gray-500 mb-6">结果较多，请换个更具体的关键词</p>
            )}
            {/* 项目卡片 */}
            {displayedItems.map((poster) => (
              <div key={poster.id} className="mb-12 border-b pb-8 last:border-b-0 last:pb-0">
                <div className="flex flex-row gap-4 items-start">
                  {/* 海报图片 - 固定宽度 */}
                  <div className="min-w-[120px] w-[120px]">
                    <PosterThumb
                      key={poster.imageUrl}
                      imageUrl={poster.imageUrl}
                      title={poster.title}
                      onOpen={() => handleShowPoster(poster)}
                    />
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

      {showPoster && currentPoster && createPortal(
        <div className="fixed inset-0 z-50 bg-black text-white" role="dialog" aria-modal="true" aria-label={currentPoster.title}>
          <button
            type="button"
            onClick={handleClosePoster}
            aria-label="关闭"
            className="fixed right-3 z-20 text-white bg-white/15 rounded-full w-10 h-10 flex items-center justify-center"
            style={{ top: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="h-full overflow-y-auto overscroll-contain px-0 pt-14 pb-28" onClick={handleBackdropClick}>
            {posterStatus === 'loading' && (
              <div
                className="relative min-h-full flex flex-col items-center justify-center gap-3 px-6"
                style={{ WebkitTouchCallout: 'none' }}
              >
                <img
                  src={posterThumbUrl(currentPoster.imageUrl)}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="absolute top-0 inset-x-0 w-full h-auto opacity-40 pointer-events-none"
                />
                <svg className="relative animate-spin h-8 w-8 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="relative text-sm text-white/80">海报加载中</p>
              </div>
            )}

            {posterStatus === 'error' && (
              <div className="min-h-full flex flex-col items-center justify-center gap-4 px-6">
                <p className="text-sm text-white/80">海报加载失败</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPosterLoadAttempt((attempt) => attempt + 1);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm"
                >
                  重试
                </button>
              </div>
            )}

            {posterStatus === 'ready' && (
              <img
                ref={posterImgRef}
                src={posterImageUrl}
                alt={currentPoster.title}
                className="block w-full h-auto"
                style={{ WebkitTouchCallout: canSavePoster ? 'default' : 'none' }}
                onLoad={() => setCanSavePoster(true)}
                onError={() => {
                  if (posterImageUrl !== currentPoster.imageUrl) {
                    setUseOriginalPoster(true);
                  } else {
                    setPosterStatus('error');
                  }
                  setCanSavePoster(false);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          <div
            className="fixed inset-x-0 bottom-0 z-20 bg-black/90 px-4 pt-3 text-center"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))', WebkitTouchCallout: 'none' }}
          >
            <p className="text-sm text-white/90">{saveHint}</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ProjectListPage;
