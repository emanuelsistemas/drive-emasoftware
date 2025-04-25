import React from 'react';
import FileUploader from './FileUploader';
import SearchBar from './SearchBar';
import { FolderPlus, Link } from 'lucide-react'; // Importar ícones

interface ActionBarProps {
  onSearch: (query: string) => void;
  onFileUpload: (fileList: FileList) => Promise<void>; // Corrigido para Promise<void>
  onFolderUpload: (fileList: FileList) => Promise<void>; // Corrigido para Promise<void>
  onCreateFolder: () => void; // Nova prop para criar pasta
  onCreateLink: () => void; // Nova prop para criar link
}

const ActionBar: React.FC<ActionBarProps> = ({
  onSearch,
  onFileUpload,
  onFolderUpload,
  onCreateFolder, // Receber a prop para criar pasta
  onCreateLink // Receber a prop para criar link
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6"> {/* Adicionado items-center */}
      <div className="w-full md:w-1/2">
        <SearchBar onSearch={onSearch} />
      </div>
      <div className="flex justify-end items-center gap-2"> {/* Adicionado items-center e gap */}
        <button
          onClick={onCreateFolder} // Chamar a função ao clicar
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors text-sm"
        >
          <FolderPlus size={18} />
          Criar Pasta
        </button>
        <button
          onClick={onCreateLink} // Chamar a função ao clicar
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-white transition-colors text-sm"
        >
          <Link size={18} />
          Criar Link
        </button>
        <FileUploader 
          onFileUpload={onFileUpload} 
          onFolderUpload={onFolderUpload} 
        />
      </div>
    </div>
  );
};

export default ActionBar;
