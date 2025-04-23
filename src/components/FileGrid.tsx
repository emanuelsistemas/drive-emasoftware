import React from 'react';
import { FileItem } from '../types';
import { formatFileSize } from '../utils/fileUtils';
import { File, Folder } from 'lucide-react';

interface FileGridProps {
  files: FileItem[];
  onItemClick: (item: FileItem) => void;
}

const FileGrid: React.FC<FileGridProps> = ({ files, onItemClick }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
      {files.map((item) => (
        <div
          key={item.id}
          onClick={() => onItemClick(item)}
          className="flex flex-col items-center p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 cursor-pointer transition-all duration-200 transform hover:scale-105"
        >
          <div className="w-12 h-12 flex items-center justify-center text-gray-300 mb-2">
            {item.type === 'folder' ? (
              <Folder size={40} className="text-yellow-500" />
            ) : (
              <File size={40} className="text-blue-400" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-200 font-medium truncate w-full max-w-[120px]">
              {item.name}
            </p>
            {item.type === 'file' && (
              <p className="text-xs text-gray-400 mt-1">{formatFileSize(item.size)}</p>
            )}
          </div>
        </div>
      ))}
      
      {files.length === 0 && (
        <div className="col-span-full flex flex-col items-center justify-center py-10 text-gray-400">
          <File size={48} strokeWidth={1} />
          <p className="mt-2">Nenhum arquivo encontrado</p>
        </div>
      )}
    </div>
  );
};

export default FileGrid;