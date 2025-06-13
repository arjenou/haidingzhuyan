import React, { useState } from 'react';
import type { PosterMetadata, PosterMetadataInput } from '../services/posterMetadataService';
import { uploadPoster } from '../services/posterService';
import { CATEGORIES } from '../constants/categories';

interface PosterFormProps {
  poster?: PosterMetadata;
  onSubmit: (data: PosterMetadataInput) => Promise<void>;
  onCancel: () => void;
}

const PosterForm: React.FC<PosterFormProps> = ({ 
  poster, 
  onSubmit, 
  onCancel
}) => {
  const [title, setTitle] = useState(poster?.title || '');
  const [description, setDescription] = useState(poster?.description || '');
  const [category, setCategory] = useState(poster?.category || '');
  const [targetAudience, setTargetAudience] = useState(poster?.targetAudience?.join(', ') || '');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState(0);

  // 如果是编辑模式，显示预览图片
  const [previewUrl, setPreviewUrl] = useState<string | null>(poster?.imageUrl || null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setPosterFile(file);

    // 预览所选图片
    const fileReader = new FileReader();
    fileReader.onload = () => {
      setPreviewUrl(fileReader.result as string);
    };
    fileReader.readAsDataURL(file);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = '请输入标题';
    if (!category) {
      newErrors.category = '请选择分类';
    }

    // 如果是新建海报且没有选择文件
    if (!poster && !posterFile) {
      newErrors.posterFile = '请选择海报图片';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setIsUploading(true);
      
      // 处理海报图片上传
      let imageKey = poster?.imageKey || '';
      let imageUrl = poster?.imageUrl || '';
      
      if (posterFile) {
        // 模拟上传进度
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const next = prev + Math.random() * 20;
            return next > 90 ? 90 : next;
          });
        }, 300);
        
        try {
          // 上传图片
          const uploadResult = await uploadPoster(posterFile);
          imageKey = uploadResult.key;
          imageUrl = uploadResult.url;
        } catch (uploadError) {
          console.error('图片上传错误:', uploadError);
          throw new Error(`图片上传失败: ${uploadError instanceof Error ? uploadError.message : '未知错误'}`);
        } finally {
          clearInterval(progressInterval);
          setUploadProgress(100);
        }
      }
      
      // 准备表单数据
      const formData: PosterMetadataInput = {
        title: title.trim(),
        description: description.trim(),
        category: category,
        targetAudience: targetAudience.split(',').map(tag => tag.trim()).filter(Boolean),
        imageKey,
        imageUrl
      };
      
      console.log('提交表单数据:', formData);
      
      // 提交表单
      await onSubmit(formData);
    } catch (error) {
      console.error('提交表单错误:', error);
      setErrors({
        submit: error instanceof Error ? error.message : '提交表单时发生错误'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.submit && (
        <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
          {errors.submit}
        </div>
      )}
      
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          标题 <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ${
            errors.title ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="请输入海报标题"
          disabled={isUploading}
        />
        {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
      </div>
      
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          描述
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          placeholder="请输入海报描述"
          rows={3}
          disabled={isUploading}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          分类 <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((cat) => (
            <div 
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`
                flex items-center p-3 border rounded-md cursor-pointer transition-all
                ${category === cat.id 
                  ? 'border-green-500 bg-green-50 text-green-700' 
                  : 'border-gray-300 hover:border-amber-300 hover:bg-amber-50'
                }
              `}
            >
              <div
                className="flex items-center justify-center w-10 h-10 rounded text-white mr-3"
                style={{ backgroundColor: cat.bgColor }}
              >
                {cat.icon}
              </div>
              <div>
                <div className="font-medium">{cat.name}</div>
                <div className="text-xs text-gray-500">{cat.englishName}</div>
              </div>
            </div>
          ))}
        </div>
        {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
      </div>
      
      <div>
        <label htmlFor="targetAudience" className="block text-sm font-medium text-gray-700 mb-1">
          适合人群
        </label>
        <input
          id="targetAudience"
          type="text"
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          placeholder="请输入适合人群，多个标签用逗号分隔"
          disabled={isUploading}
        />
        <p className="mt-1 text-xs text-gray-500">多个标签请用逗号分隔，例如：大学生, 考研学生, 成人</p>
      </div>
      
      <div>
        <label htmlFor="posterFile" className="block text-sm font-medium text-gray-700 mb-1">
          海报图片 {!poster && <span className="text-red-500">*</span>}
        </label>
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {previewUrl && (
            <div className="w-40 h-40 rounded-md overflow-hidden">
              <img 
                src={previewUrl} 
                alt="海报预览" 
                className="w-full h-full object-cover" 
              />
            </div>
          )}
          
          <div className="flex-1">
            <input
              id="posterFile"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => document.getElementById('posterFile')?.click()}
                className={`px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors ${
                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isUploading}
              >
                {poster ? '更换图片' : '选择图片'}
              </button>
              {posterFile && (
                <p className="text-sm text-gray-600">
                  已选择: {posterFile.name} ({Math.round(posterFile.size / 1024)} KB)
                </p>
              )}
              {errors.posterFile && <p className="text-sm text-red-500">{errors.posterFile}</p>}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          disabled={isUploading}
        >
          取消
        </button>
        <button
          type="submit"
          className={`px-5 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-500 transition-colors ${
            isUploading ? 'opacity-70 cursor-not-allowed' : ''
          }`}
          disabled={isUploading}
        >
          {isUploading ? (
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {uploadProgress > 0 ? `上传中 (${Math.round(uploadProgress)}%)` : '处理中...'}
            </div>
          ) : (
            poster ? '保存修改' : '创建海报'
          )}
        </button>
      </div>
    </form>
  );
};

export default PosterForm; 