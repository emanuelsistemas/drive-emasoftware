import React, { useState, useEffect, useCallback } from 'react';
import { FileItem } from './types';
import { processFiles, generateBreadcrumbs } from './utils/fileUtils';
import Breadcrumb from './components/Breadcrumb';
import FileGrid from './components/FileGrid';
import ActionBar from './components/ActionBar';
import { supabase } from './lib/supabase';

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState(generateBreadcrumbs('/'));
  
  const loadFiles = async () => {
    const { data: filesData } = await supabase
      .from('files')
      .select('*')
      .eq('is_private', false);

    const { data: foldersData } = await supabase
      .from('folders')
      .select('*')
      .eq('is_private', false);

    const items: FileItem[] = [
      ...(foldersData || []).map(folder => ({
        id: folder.id,
        name: folder.name,
        type: 'folder' as const,
        path: folder.path,
        parent: folder.parent_id
      })),
      ...(filesData || []).map(file => ({
        id: file.id,
        name: file.name,
        type: 'file' as const,
        size: file.size,
        path: file.path,
        parent: file.folder_id
      }))
    ];

    setFiles(items);
  };

  useEffect(() => {
    loadFiles();
  }, []);
  
  const getCurrentFiles = useCallback(() => {
    return files.filter(file => {
      const filePath = file.path.substring(0, file.path.lastIndexOf('/') + 1);
      return filePath === currentPath;
    });
  }, [files, currentPath]);
  
  useEffect(() => {
    setBreadcrumbs(generateBreadcrumbs(currentPath));
    updateFilteredFiles();
  }, [currentPath, files, searchQuery]);
  
  const updateFilteredFiles = useCallback(() => {
    const currentFiles = getCurrentFiles();
    
    if (!searchQuery) {
      setFilteredFiles(currentFiles);
      return;
    }
    
    const lowerQuery = searchQuery.toLowerCase();
    setFilteredFiles(
      currentFiles.filter(file => 
        file.name.toLowerCase().includes(lowerQuery)
      )
    );
  }, [getCurrentFiles, searchQuery]);
  
  const handleItemClick = async (item: FileItem) => {
    if (item.type === 'folder') {
      setCurrentPath(item.path);
    } else {
      const { data } = await supabase.storage
        .from('files')
        .createSignedUrl(item.path, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };
  
  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path);
  };
  
  const handleFileUpload = async (fileList: FileList) => {
    const newFiles = await processFiles(fileList, currentPath);
    await loadFiles();
  };
  
  const handleFolderUpload = async (fileList: FileList) => {
    const newFiles = await processFiles(fileList, currentPath);
    await loadFiles();
  };
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-6">
      <main className="max-w-7xl mx-auto">
        <ActionBar
          onSearch={handleSearch}
          onFileUpload={handleFileUpload}
          onFolderUpload={handleFolderUpload}
        />
        
        <div className="border-b border-gray-800 pb-2">
          <Breadcrumb 
            items={breadcrumbs} 
            onNavigate={handleBreadcrumbClick} 
          />
        </div>
        
        <FileGrid 
          files={filteredFiles} 
          onItemClick={handleItemClick} 
        />
      </main>
    </div>
  );
}

export default App;