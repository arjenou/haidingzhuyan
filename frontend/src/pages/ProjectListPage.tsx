import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getPosterDownloadUrl } from '../services/posterService';
import { searchPosterMetadata, getAllCategories } from '../services/posterMetadataService';
import type { PosterMetadata } from '../services/posterMetadataService';

interface Project {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  posterKey?: string;
}

const ProjectListPage: React.FC = () => {
  const { version } = useParams<{ version: string; subject: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [showPoster, setShowPoster] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [posters, setPosters] = useState<PosterMetadata[]>([]);

  // 加载海报数据和分类
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // 并行加载数据
        const [categoriesData, postersData] = await Promise.all([
          getAllCategories(),
          searchPosterMetadata('', '')
        ]);
        
        setCategories(categoriesData);
        setPosters(postersData);
      } catch (err) {
        console.error('加载数据失败:', err);
        setError('加载数据失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // 搜索海报
  useEffect(() => {
    const searchPosters = async () => {
      try {
        setIsLoading(true);
        const results = await searchPosterMetadata(searchQuery, selectedCategory);
        setPosters(results);
      } catch (err) {
        console.error('搜索失败:', err);
        setError('搜索失败，请重试');
      } finally {
        setIsLoading(false);
      }
    };
    
    searchPosters();
  }, [searchQuery, selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleShowPoster = async (poster: PosterMetadata) => {
    setCurrentProject({
      id: poster.id,
      title: poster.title,
      description: poster.description,
      imageUrl: poster.imageUrl,
      posterKey: poster.imageKey
    });
    setShowPoster(true);
    setIsDownloading(true);
    setError(null);
    setPosterUrl(null);

    try {
      if (poster.imageKey) {
        const { url } = await getPosterDownloadUrl(poster.imageKey);
        setPosterUrl(url);
      } else {
        setPosterUrl(poster.imageUrl);
      }
    } catch (err) {
      console.error('获取海报链接出错:', err);
      setError('获取海报链接失败，请稍后再试');
      setPosterUrl(poster.imageUrl);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCloseModal = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowPoster(false);
    }
  };

  return (
    <>
      {/* 顶部搜索栏 */}
      <div className="bg-white shadow-sm py-4 px-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(`/subjects/${version}`)}
            className="text-gray-600 hover:text-gray-800 mr-4"
          >
            <span className="text-xl">←</span>
          </button>
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md py-3 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="请输入项目名称/综合专业/导师院校/一二级学科/标签等关键词"
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
          
          {/* 管理入口，放在右侧 */}
          <Link 
            to="/admin" 
            className="ml-4 text-sm text-gray-500 hover:text-gray-700"
          >
            管理
          </Link>
        </div>
        
        {/* 分类筛选 */}
        <div className="max-w-4xl mx-auto mt-3 flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
              selectedCategory === '' 
                ? 'bg-amber-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </button>
          
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                selectedCategory === category 
                  ? 'bg-amber-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
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
        ) : posters.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            没有找到符合条件的海报
          </div>
        ) : (
          <>
            {/* 项目卡片 */}
            {posters.map((poster) => (
              <div key={poster.id} className="mb-12 border-b pb-8 last:border-b-0 last:pb-0">
                <div className="flex gap-4">
                  <div className="w-1/2">
                    <div className="relative overflow-hidden rounded-lg shadow-md">
                      <img
                        src={poster.imageUrl}
                        alt={poster.title}
                        className="w-full h-full object-cover object-top"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-transparent p-4">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleShowPoster(poster)}
                            className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-2 py-1 rounded cursor-pointer transition-colors flex items-center justify-center gap-1"
                          >
                            <span className="text-white text-xs">⚡</span>
                            <span>查看海报</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-1/2">
                    <h2 className="text-lg font-bold text-gray-800 mb-2">{poster.title}</h2>
                    <p className="text-sm text-gray-600 mb-4">{poster.description}</p>
                    
                    {/* 显示分类标签 */}
                    <div className="mb-2">
                      <span className="inline-block bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">
                        {poster.category}
                      </span>
                    </div>
                    
                    {/* 显示适合人群标签 */}
                    {poster.targetAudience.length > 0 && (
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
          </>
        )}
      </div>

      {/* Poster Modal */}
      {showPoster && currentProject && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div className="relative max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={() => setShowPoster(false)}
                className="w-8 h-8 bg-white/10 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <span className="text-xl">×</span>
              </button>
            </div>
            <div className="p-4 flex justify-center items-center">
              <div className="w-full flex justify-center items-center">
                {isDownloading ? (
                  <div className="flex flex-col items-center justify-center p-8">
                    <svg className="animate-spin h-8 w-8 text-amber-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-gray-700">正在加载海报...</p>
                  </div>
                ) : error ? (
                  <div className="text-center text-red-500 p-4">
                    <p>{error}</p>
                  </div>
                ) : (
                  <img
                    src={posterUrl || currentProject.imageUrl}
                    alt="Poster"
                    className="max-h-[70vh] object-contain"
                  />
                )}
              </div>
            </div>
            <div className="px-6 pb-6 bg-white">
              <a
                href={posterUrl || currentProject.imageUrl}
                download={`${currentProject.title}-海报.jpg`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-amber-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-amber-500 transition-colors flex items-center justify-center gap-2 font-medium text-base w-full"
              >
                <span className="text-white text-base">⚡</span>
                <span>下载海报</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectListPage; 