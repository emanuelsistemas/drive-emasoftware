import React, { useRef } from 'react';
import { Upload, FolderUp } from 'lucide-react';

interface FileUploaderProps {
  onFileUpload: (fileList: FileList) => void;
  onFolderUpload: (fileList: FileList) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileUpload, 
  onFolderUpload 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files);
      // Reset o input para que o mesmo arquivo possa ser carregado novamente
      e.target.value = '';
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFolderUpload(e.target.files);
      // Reset o input para que a mesma pasta possa ser carregada novamente
      e.target.value = '';
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
      />
      
      <button
        onClick={handleFileClick}
        className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors"
      >
        <Upload size={18} className="mr-2" />
        Enviar Arquivo
      </button>
      
      <button
        onClick={handleFolderClick}
        className="flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md text-white transition-colors"
      >
        <FolderUp size={18} className="mr-2" />
        Enviar Pasta
      </button>
    </div>
  );
};

export default FileUploader;