import React, { useState, useEffect, useRef, useCallback } from 'react';
import AdminLogin from '../components/AdminLogin';
import PosterForm from '../components/PosterForm';
import { isLoggedIn, logout } from '../services/authService';
import type { PosterMetadata, PosterMetadataInput } from '../services/posterMetadataService';
import { 
  getAllPosterMetadataForInfiniteScroll, 
  createPosterMetadata, 
  updatePosterMetadata, 
  deletePosterMetadata,
  clearAllMetadata,
  clearAllPosters,
  clearAllData,
  regenerateAllData
} from '../services/posterMetadataService';
import { CATEGORIES } from '../constants/categories';

const AdminPage: React.FC = () => {
  // 认证状态
  const [authenticated, setAuthenticated] = useState(false);
  // 数据加载状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 海报数据
  const [posters, setPosters] = useState<PosterMetadata[]>([]);
  const [displayedPosters, setDisplayedPosters] = useState<PosterMetadata[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // 无限滚动配置
  const ITEMS_PER_LOAD = 20; // 每次加载20个项目
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  
  // 表单控制
  const [showForm, setShowForm] = useState(false);
  const [editingPoster, setEditingPoster] = useState<PosterMetadata | null>(null);
  // 搜索和筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  // 删除确认
  const [deletingPoster, setDeletingPoster] = useState<PosterMetadata | null>(null);
  // 详情查看
  const [viewingPoster, setViewingPoster] = useState<PosterMetadata | null>(null);
  // 清空数据确认
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [clearDataType, setClearDataType] = useState<'metadata' | 'posters' | 'all'>('all');
  const [isClearing, setIsClearing] = useState(false);
  // 重新生成数据
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateSuccess, setRegenerateSuccess] = useState<string | null>(null);

  // 加载认证状态
  useEffect(() => {
    const auth = isLoggedIn();
    setAuthenticated(auth);
    
    // 如果已认证，加载数据
    if (auth) {
      loadData();
    } else {
      setLoading(false);
    }
  }, []);

  // 加载数据
  const loadData = async (category?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const allPosters = await getAllPosterMetadataForInfiniteScroll(category);
      setPosters(allPosters);
      setCurrentIndex(0);
      setDisplayedPosters([]);
      setHasMore(allPosters.length > 0);
    } catch (err) {
      console.error('加载数据失败:', err);
      setError('加载数据失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载更多数据
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    
    // 模拟异步加载
    setTimeout(() => {
      const nextIndex = currentIndex + ITEMS_PER_LOAD;
      const newItems = posters.slice(currentIndex, nextIndex);
      
      setDisplayedPosters(prev => [...prev, ...newItems]);
      setCurrentIndex(nextIndex);
      setHasMore(nextIndex < posters.length);
      setIsLoadingMore(false);
    }, 300);
  }, [currentIndex, posters, isLoadingMore, hasMore]);

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

  // 初始加载数据
  useEffect(() => {
    if (posters.length > 0 && displayedPosters.length === 0) {
      loadMore();
    }
  }, [posters, displayedPosters.length, loadMore]);

  // 处理登录成功
  const handleLoginSuccess = () => {
    setAuthenticated(true);
    loadData();
  };

  // 处理退出登录
  const handleLogout = () => {
    logout();
    setAuthenticated(false);
  };

  // 打开创建表单
  const handleAddNew = () => {
    setEditingPoster(null);
    setShowForm(true);
  };

  // 打开编辑表单
  const handleEdit = (poster: PosterMetadata) => {
    setEditingPoster(poster);
    setShowForm(true);
    setViewingPoster(null);
  };

  // 关闭表单
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPoster(null);
  };

  // 打开删除确认
  const handleConfirmDelete = (poster: PosterMetadata) => {
    setDeletingPoster(poster);
    setViewingPoster(null);
  };

  // 取消删除
  const handleCancelDelete = () => {
    setDeletingPoster(null);
  };

  // 执行删除
  const handleDelete = async () => {
    if (!deletingPoster) return;
    
    try {
      setLoading(true);
      await deletePosterMetadata(deletingPoster.id);
      
      // 重新加载数据
      await loadData(selectedCategory);
      setDeletingPoster(null);
    } catch (err) {
      console.error('删除失败:', err);
      setError('删除海报失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 关闭海报详情
  const handleCloseViewPoster = () => {
    setViewingPoster(null);
  };

  // 打开清空数据对话框
  const handleOpenClearDataDialog = (type: 'metadata' | 'posters' | 'all') => {
    setClearDataType(type);
    setShowClearDataDialog(true);
  };

  // 关闭清空数据对话框
  const handleCloseClearDataDialog = () => {
    setShowClearDataDialog(false);
  };

  // 执行清空数据
  const handleClearData = async () => {
    setIsClearing(true);
    setError(null);
    
    try {
      let result;
      
      switch (clearDataType) {
        case 'metadata':
          result = await clearAllMetadata();
          break;
        case 'posters':
          result = await clearAllPosters();
          break;
        case 'all':
          result = await clearAllData();
          break;
      }
      
      // 清空本地状态
      setPosters([]);
      setDisplayedPosters([]);
      setCurrentIndex(0);
      setHasMore(false);
      
      // 清空成功后，重新加载数据
      await loadData();
      setShowClearDataDialog(false);
      
      // 显示成功消息
      alert(result.message || '清空成功');
    } catch (err) {
      console.error('清空数据失败:', err);
      setError(err instanceof Error ? err.message : '清空数据失败，请重试');
    } finally {
      setIsClearing(false);
    }
  };

  // 重新生成所有数据
  const handleRegenerateData = async () => {
    setIsRegenerating(true);
    setError(null);
    setRegenerateSuccess(null);
    
    try {
      const result = await regenerateAllData();
      
      // 显示成功消息
      const exportInfo = result.exportResult;
      const totalPosters = exportInfo.totalPosters || 0;
      const categoryCount = Object.keys(exportInfo.categories || {}).length;
      
      setRegenerateSuccess(
        `✅ 重新生成成功！\n` +
        `- 导出了 ${totalPosters} 个海报\n` +
        `- 覆盖 ${categoryCount} 个分类\n` +
        `- 搜索索引已更新`
      );
      
      // 3秒后自动关闭成功消息
      setTimeout(() => {
        setRegenerateSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('重新生成数据失败:', err);
      setError(err instanceof Error ? err.message : '重新生成数据失败，请重试');
    } finally {
      setIsRegenerating(false);
    }
  };

  // 处理表单提交
  const handleFormSubmit = async (data: PosterMetadataInput) => {
    try {
      if (editingPoster) {
        // 更新海报
        const updated = await updatePosterMetadata(editingPoster.id, data);
        setPosters(posters.map(p => p.id === editingPoster.id ? updated : p));
      } else {
        // 创建新海报
        const created = await createPosterMetadata(data);
        setPosters([created, ...posters]);
      }
      
      setShowForm(false);
      setEditingPoster(null);
    } catch (err) {
      console.error('保存海报失败:', err);
      throw err; // 让表单组件处理错误
    }
  };

  // 筛选海报
  const filteredPosters = displayedPosters.filter(poster => {
    // 按分类筛选
    if (selectedCategory && poster.category !== selectedCategory) {
      return false;
    }
    
    // 按关键词搜索
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        poster.title.toLowerCase().includes(query) ||
        poster.description.toLowerCase().includes(query) ||
        poster.category.toLowerCase().includes(query) ||
        poster.targetAudience.some(audience => 
          audience.toLowerCase().includes(query)
        )
      );
    }
    
    return true;
  });

  // 如果未登录，显示登录界面
  if (!authenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-xl font-semibold text-gray-900">海报管理系统</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRegenerateData}
                disabled={isRegenerating}
                className="text-sm px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-green-300 disabled:cursor-not-allowed flex items-center gap-2"
                title="重新生成导出数据和搜索索引"
              >
                {isRegenerating && (
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isRegenerating ? '生成中...' : '🔄 重新生成数据'}
              </button>
              <button
                onClick={() => handleOpenClearDataDialog('all')}
                className="text-sm px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                title="清空所有数据（KV + R2）"
              >
                清空所有数据
              </button>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                退出登录
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 工具栏 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="搜索海报标题、描述、分类或标签"
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <select
              className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                loadData(e.target.value || undefined);
              }}
            >
              <option value="">所有分类</option>
              {CATEGORIES.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <button
              onClick={handleAddNew}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
            >
              添加海报
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {regenerateSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md whitespace-pre-line">
            {regenerateSuccess}
          </div>
        )}

        {/* 海报列表 */}
        {loading ? (
          <div className="text-center py-12">
            <svg className="animate-spin h-8 w-8 text-amber-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : filteredPosters.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            没有找到符合条件的海报
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    图片
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    标题
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    分类
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPosters.map((poster, idx) => (
                  <tr key={poster.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-16 h-16 relative">
                        <img 
                          src={poster.imageUrl} 
                          alt={poster.title}
                          className="w-full h-full object-cover rounded-md"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {poster.title}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {poster.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(poster)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleConfirmDelete(poster)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* 无限滚动加载指示器 */}
        {hasMore && (
          <div ref={loadingRef} className="flex justify-center py-6">
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
        
        {/* 没有更多数据提示 */}
        {!hasMore && displayedPosters.length > 0 && (
          <div className="text-center py-6 text-gray-500">
            <p>已显示所有内容</p>
          </div>
        )}
      </main>

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
            <button
              onClick={handleCloseForm}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
            >
              <span className="text-xl">×</span>
            </button>
            <h2 className="text-lg font-medium text-gray-900 mb-6">
              {editingPoster ? '编辑海报' : '添加海报'}
            </h2>
            <PosterForm
              poster={editingPoster || undefined}
              onSubmit={handleFormSubmit}
              onCancel={handleCloseForm}
            />
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deletingPoster && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-3">确认删除</h2>
            <p className="text-gray-500 mb-6">
              确定要删除海报 "{deletingPoster.title}" 吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 查看海报弹窗 */}
      {viewingPoster && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 relative">
            <button
              onClick={handleCloseViewPoster}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
            >
              <span className="text-xl">×</span>
            </button>
            <div className="text-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">{viewingPoster.title}</h2>
              <p className="text-sm text-gray-500">{viewingPoster.description}</p>
            </div>
            <div className="flex justify-center mb-6">
              <img
                src={viewingPoster.imageUrl}
                alt={viewingPoster.title}
                className="max-h-[60vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* 清空数据确认对话框 */}
      {showClearDataDialog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-3">⚠️ 危险操作确认</h2>
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                {clearDataType === 'metadata' && '确定要清空所有KV数据库中的海报元数据吗？'}
                {clearDataType === 'posters' && '确定要清空所有R2存储中的海报图片吗？'}
                {clearDataType === 'all' && '确定要清空所有数据吗？包括：'}
              </p>
              {clearDataType === 'all' && (
                <ul className="list-disc list-inside text-gray-600 text-sm space-y-1 mb-3">
                  <li>KV数据库中的所有海报元数据</li>
                  <li>R2存储中的所有海报图片</li>
                </ul>
              )}
              <p className="text-red-600 font-semibold text-sm">
                ⚠️ 此操作不可撤销，所有数据将被永久删除！
              </p>
            </div>
            
            <div className="space-y-3">
              {clearDataType === 'all' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowClearDataDialog(false);
                      handleOpenClearDataDialog('metadata');
                    }}
                    className="flex-1 px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-sm"
                    disabled={isClearing}
                  >
                    只清空KV数据
                  </button>
                  <button
                    onClick={() => {
                      setShowClearDataDialog(false);
                      handleOpenClearDataDialog('posters');
                    }}
                    className="flex-1 px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-sm"
                    disabled={isClearing}
                  >
                    只清空R2数据
                  </button>
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCloseClearDataDialog}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  disabled={isClearing}
                >
                  取消
                </button>
                <button
                  onClick={handleClearData}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={isClearing}
                >
                  {isClearing && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isClearing ? '清空中...' : '确认清空'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage; 