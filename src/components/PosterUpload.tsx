import React, { useState, useRef } from 'react';
import { uploadPoster } from '../services/posterService';

interface PosterUploadProps {
  onUploadSuccess?: (data: { url: string; key: string }) => void;
  onUploadError?: (error: Error) => void;
  className?: string;
}

const PosterUpload: React.FC<PosterUploadProps> = ({ 
  onUploadSuccess, 
  onUploadError,
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);
    setProgress(10);

    try {
      // 简单模拟上传进度
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const next = prev + Math.random() * 20;
          return next > 90 ? 90 : next;
        });
      }, 300);

      const result = await uploadPoster(file);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      if (onUploadSuccess) {
        onUploadSuccess(result);
      }

      // 重置表单，以便可以再次上传同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      if (onUploadError && error instanceof Error) {
        onUploadError(error);
      }
      console.error('上传出错:', error);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`${className}`}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <button
        onClick={triggerFileInput}
        disabled={uploading}
        className={`flex items-center justify-center px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-500 transition-colors ${
          uploading ? 'opacity-70 cursor-not-allowed' : ''
        }`}
      >
        {uploading ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            上传中 ({Math.round(progress)}%)
          </div>
        ) : (
          <>
            <span className="mr-1">⚡</span>
            上传海报
          </>
        )}
      </button>
    </div>
  );
};

export default PosterUpload; 