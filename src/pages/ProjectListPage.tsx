import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPosterDownloadUrl } from '../services/posterService';
import PosterUpload from '../components/PosterUpload';

interface Project {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  posterKey?: string; // R2 中海报的 key
}

const ProjectListPage: React.FC = () => {
  const { version, subject } = useParams<{ version: string; subject: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showPoster, setShowPoster] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Searching for:', searchQuery);
  };

  const handleShowPoster = async (project: Project) => {
    setCurrentProject(project);
    setShowPoster(true);
    setIsDownloading(true);
    setError(null);
    setPosterUrl(null);

    try {
      // 如果项目有 posterKey，则从 R2 获取下载链接
      if (project.posterKey) {
        const { url } = await getPosterDownloadUrl(project.posterKey);
        setPosterUrl(url);
      } else {
        // 如果没有 posterKey，使用默认图片 URL
        setPosterUrl(project.imageUrl);
      }
    } catch (err) {
      console.error('获取海报链接出错:', err);
      setError('获取海报链接失败，请稍后再试');
      setPosterUrl(project.imageUrl); // 回退到项目图片
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCloseModal = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowPoster(false);
    }
  };

  const handlePosterUploadSuccess = (project: Project) => (data: { url: string; key: string }) => {
    // 更新项目的 posterKey
    project.posterKey = data.key;
    alert('海报上传成功！');
  };

  const handlePosterUploadError = (error: Error) => {
    console.error('海报上传失败:', error);
    alert(`上传失败: ${error.message}`);
  };

  // Mock projects data
  const projects: Project[] = [
    {
      id: '1',
      title: '从信息管理、信息系统到数据科学、人工智能和量子计算',
      description: '— 信息管理、信息技术、信息安全、数据科学、人工智能、计算机、软件工程、数学、通信工程、等相关专业',
      imageUrl: 'https://readdy.ai/api/search-image?query=Digital%20technology%20concept%20with%20blue%20abstract%20data%20visualization%2C%20cybersecurity%20theme%20with%20binary%20code%20patterns%2C%20modern%20tech%20background%20for%20information%20management%20and%20artificial%20intelligence&width=400&height=500&seq=1&orientation=portrait'
    },
    {
      id: '2',
      title: '系统工程在基础设施建筑中的价值探究',
      description: '— 土木工程、建筑工程、系统工程、工业工程、工程管理、运筹学等相关专业',
      imageUrl: 'https://readdy.ai/api/search-image?query=Urban%20construction%20site%20with%20modern%20buildings%2C%20engineering%20blueprints%20overlay%2C%20infrastructure%20development%20concept%20with%20clean%20minimalist%20background%20for%20system%20engineering%20value%20exploration&width=400&height=500&seq=2&orientation=portrait'
    },
    {
      id: '3',
      title: '可穿戴电子设备，物联网与无线通信',
      description: '— 电子工程、机械工程、生物医学工程、物联网、计算机等相关专业',
      imageUrl: 'https://readdy.ai/api/search-image?query=Wearable%20electronic%20devices%20with%20IoT%20connectivity%20visualization%2C%20wireless%20communication%20technology%20concept%20with%20circuit%20board%20patterns%2C%20futuristic%20tech%20background%20with%20blue%20digital%20elements&width=400&height=500&seq=3&orientation=portrait'
    },
    {
      id: '4',
      title: '设备直连通信(D2D)在异构蜂窝与小蜂窝网络中的应用',
      description: '— 电子工程、通信工程、微电子学等相关专业',
      imageUrl: 'https://readdy.ai/api/search-image?query=Device-to-device%20communication%20network%20visualization%20with%20honeycomb%20and%20mesh%20network%20patterns%2C%20wireless%20technology%20concept%20with%20blue%20digital%20elements%2C%20modern%20tech%20background%20for%20telecommunications&width=400&height=500&seq=4&orientation=portrait'
    }
  ];

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
        </div>
      </div>

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* 项目卡片 */}
        {projects.map((project) => (
          <div key={project.id} className="mb-12 border-b pb-8 last:border-b-0 last:pb-0">
            <div className="flex gap-4">
              <div className="w-1/2">
                <div className="relative overflow-hidden rounded-lg shadow-md">
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-transparent p-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleShowPoster(project)}
                        className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-2 py-1 rounded cursor-pointer transition-colors flex items-center justify-center gap-1"
                      >
                        <span className="text-white text-xs">⚡</span>
                        <span>查看海报</span>
                      </button>
                      
                      <PosterUpload 
                        onUploadSuccess={handlePosterUploadSuccess(project)}
                        onUploadError={handlePosterUploadError}
                        className="text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-1/2">
                <h2 className="text-lg font-bold text-gray-800 mb-2">{project.title}</h2>
                <p className="text-sm text-gray-600 mb-4">{project.description}</p>
              </div>
            </div>
          </div>
        ))}
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