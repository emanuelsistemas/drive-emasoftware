import React from 'react';
import FileUploader from './FileUploader';
import SearchBar from './SearchBar';

interface ActionBarProps {
  onSearch: (query: string) => void;
  onFileUpload: (fileList: FileList) => void;
  onFolderUpload: (fileList: FileList) => void;
}

const ActionBar: React.FC<ActionBarProps> = ({
  onSearch,
  onFileUpload,
  onFolderUpload
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
      <div className="w-full md:w-1/2">
        <SearchBar onSearch={onSearch} />
      </div>
      <div className="flex justify-end">
        <FileUploader 
          onFileUpload={onFileUpload} 
          onFolderUpload={onFolderUpload} 
        />
      </div>
    </div>
  );
};

export default ActionBar;