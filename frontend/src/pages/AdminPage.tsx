import React, { useState, useEffect } from 'react';
import AdminLogin from '../components/AdminLogin';
import PosterForm from '../components/PosterForm';
import { isLoggedIn, logout } from '../services/authService';
import type { PosterMetadata, PosterMetadataInput } from '../services/posterMetadataService';
import { 
  getAllPosterMetadata, 
  createPosterMetadata, 
  updatePosterMetadata, 
  deletePosterMetadata,
  getAllCategories
} from '../services/posterMetadataService';

const AdminPage: React.FC = () => {
  // 认证状态
  const [authenticated, setAuthenticated] = useState(false);
  // 数据加载状态
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 海报数据
  const [posters, setPosters] = useState<PosterMetadata[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  // 表单控制
  const [showForm, setShowForm] = useState(false);
  const [editingPoster, setEditingPoster] = useState<PosterMetadata | null>(null);
  // 搜索和筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  // 删除确认
  const [deletingPoster, setDeletingPoster] = useState<PosterMetadata | null>(null);

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
  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 并行加载海报和分类数据
      const [postersData, categoriesData] = await Promise.all([
        getAllPosterMetadata(),
        getAllCategories()
      ]);
      
      setPosters(postersData);
      setCategories(categoriesData);
    } catch (err) {
      console.error('加载数据失败:', err);
      setError('加载数据失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  };

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
  };

  // 关闭表单
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPoster(null);
  };

  // 打开删除确认
  const handleConfirmDelete = (poster: PosterMetadata) => {
    setDeletingPoster(poster);
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
      
      // 更新列表
      setPosters(posters.filter(p => p.id !== deletingPoster.id));
      setDeletingPoster(null);
    } catch (err) {
      console.error('删除失败:', err);
      setError('删除海报失败，请重试');
    } finally {
      setLoading(false);
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
      
      // 如果有新分类，更新分类列表
      if (data.category && !categories.includes(data.category)) {
        setCategories([...categories, data.category]);
      }
      
      setShowForm(false);
      setEditingPoster(null);
    } catch (err) {
      console.error('保存海报失败:', err);
      throw err; // 让表单组件处理错误
    }
  };

  // 筛选海报
  const filteredPosters = posters.filter(poster => {
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
            <button
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-900"
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 错误提示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* 搜索和操作栏 */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* 搜索框 */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="搜索海报..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
            
            {/* 分类筛选 */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">所有分类</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          
          {/* 添加按钮 */}
          <button
            onClick={handleAddNew}
            className="bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-500 transition-colors"
          >
            添加海报
          </button>
        </div>

        {/* 海报列表 */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <svg className="animate-spin h-8 w-8 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : filteredPosters.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            {searchQuery || selectedCategory ? '没有找到匹配的海报' : '还没有添加海报'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredPosters.map((poster) => (
              <div key={poster.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* 海报图片 */}
                  <div className="w-full md:w-1/4 h-48 md:h-auto">
                    <img
                      src={poster.imageUrl}
                      alt={poster.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* 海报信息 */}
                  <div className="flex-1 p-6">
                    <div className="flex flex-col md:flex-row justify-between">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">
                          {poster.title}
                        </h2>
                        <div className="mb-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            {poster.category}
                          </span>
                        </div>
                        <p className="text-gray-600 mb-4">{poster.description}</p>
                        
                        {poster.targetAudience.length > 0 && (
                          <div className="mb-4">
                            <p className="text-sm text-gray-500 mb-1">适合人群:</p>
                            <div className="flex flex-wrap gap-1">
                              {poster.targetAudience.map((audience, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                                >
                                  {audience}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <p className="text-xs text-gray-500">
                          最后更新: {new Date(poster.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      
                      {/* 操作按钮 */}
                      <div className="mt-4 md:mt-0 flex md:flex-col gap-2">
                        <button
                          onClick={() => handleEdit(poster)}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors text-sm"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleConfirmDelete(poster)}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingPoster ? '编辑海报' : '添加海报'}
                </h2>
                <button
                  onClick={handleCloseForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              
              <PosterForm
                poster={editingPoster || undefined}
                onSubmit={handleFormSubmit}
                onCancel={handleCloseForm}
                categories={categories}
              />
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deletingPoster && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">确认删除</h3>
              <p className="text-gray-600 mb-6">
                您确定要删除海报 "{deletingPoster.title}" 吗？此操作无法撤销。
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  确认删除
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