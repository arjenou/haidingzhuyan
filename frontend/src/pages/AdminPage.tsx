import React, { useState, useEffect } from 'react';
import AdminLogin from '../components/AdminLogin';
import PosterForm from '../components/PosterForm';
import { isLoggedIn, logout } from '../services/authService';
import type { PosterMetadata, PosterMetadataInput } from '../services/posterMetadataService';
import { 
  getAllPosterMetadata, 
  createPosterMetadata, 
  updatePosterMetadata, 
  deletePosterMetadata
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
      const postersData = await getAllPosterMetadata(category);
      setPosters(postersData);
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


  // 关闭海报详情
  const handleCloseViewPoster = () => {
    setViewingPoster(null);
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
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              退出登录
            </button>
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
              placeholder="搜索海报标题、描述、分类或标签..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <select
              className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
    </div>
  );
};

export default AdminPage; 