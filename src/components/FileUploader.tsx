import React, { useRef, useState } from 'react';
import { Upload, FolderUp, Loader2 } from 'lucide-react';

interface FileUploaderProps {
  onFileUpload: (fileList: FileList) => Promise<void>;
  onFolderUpload: (fileList: FileList) => Promise<void>;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileUpload, 
  onFolderUpload 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFolderClick = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        await onFileUpload(e.target.files);
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    }
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        await onFolderUpload(e.target.files);
      } finally {
        setIsUploading(false);
        e.target.value = '';
      }
    }
  };

  return (
    <div className="flex gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
        disabled={isUploading}
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderChange}
        /* @ts-ignore */
        webkitdirectory=""
        /* @ts-ignore */
        directory=""
        multiple
        className="hidden"
        disabled={isUploading}
      />
      
      <button
        onClick={handleFileClick}
        disabled={isUploading}
        className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <Loader2 size={18} className="mr-2 animate-spin" />
        ) : (
          <Upload size={18} className="mr-2" />
        )}
        {isUploading ? 'Enviando...' : 'Enviar Arquivo'}
      </button>
      
      <button
        onClick={handleFolderClick}
        disabled={isUploading}
        className="flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <Loader2 size={18} className="mr-2 animate-spin" />
        ) : (
          <FolderUp size={18} className="mr-2" />
        )}
        {isUploading ? 'Enviando...' : 'Enviar Pasta'}
      </button>
    </div>
  );
};

export default FileUploader;