import React, { useState, useEffect, useCallback } from 'react';
import { FileItem } from './types';
import { processFiles, generateBreadcrumbs } from './utils/fileUtils';
import Breadcrumb from './components/Breadcrumb';
import FileGrid from './components/FileGrid';
import ActionBar from './components/ActionBar';
import Auth from './components/Auth';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState(generateBreadcrumbs('/'));
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    // Verificar usuário atual
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    // Escutar mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadFiles = async () => {
    if (!user) return;

    try {
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id);

      if (filesError) throw filesError;

      const { data: foldersData, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id);

      if (foldersError) throw foldersError;

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
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [user]);
  
  const getCurrentFiles = useCallback(() => {
    return files.filter(file => {
      // For root directory
      if (currentPath === '/') {
        return !file.parent;
      }
      
      // For other directories
      return file.parent === files.find(f => 
        f.type === 'folder' && f.path === currentPath
      )?.id;
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
    await processFiles(fileList, currentPath);
    await loadFiles();
  };
  
  const handleFolderUpload = async (fileList: FileList) => {
    await processFiles(fileList, currentPath);
    await loadFiles();
  };
  
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (!user) {
    return <Auth />;
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-6">
      <main className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-['MuseoModerno'] text-2xl bg-gradient-to-r from-blue-600 via-blue-400 to-blue-500 text-transparent bg-clip-text">
            drive
          </h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white transition-colors"
          >
            Sair
          </button>
        </div>

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
          onFileUpdate={loadFiles}
        />
      </main>
    </div>
  );
}

export default App;