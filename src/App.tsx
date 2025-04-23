import React, { useState, useEffect, useCallback } from 'react';
import { FileItem } from './types';
import { processFiles, generateBreadcrumbs } from './utils/fileUtils';
import Breadcrumb from './components/Breadcrumb';
import FileGrid from './components/FileGrid';
import ActionBar from './components/ActionBar';
import Auth from './components/Auth';
import CreateFolderModal from './components/CreateFolderModal'; // Importar o modal
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // Importar uuid

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false); // Estado do modal
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
    // For root directory
    if (currentPath === '/') {
      return !searchQuery ? files.filter(file => !file.parent) : files;
    }
    
    // For other directories, if not searching
    if (!searchQuery) {
      return files.filter(file => 
        file.parent === files.find(f => 
          f.type === 'folder' && f.path === currentPath
        )?.id
      );
    }
    
    // When searching, return all files that match the search
    return files;
  }, [files, currentPath, searchQuery]);
  
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
      setSearchQuery(''); // Clear search when navigating
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
    setSearchQuery(''); // Clear search when navigating
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

  const handleOpenCreateFolderModal = () => {
    setIsCreateFolderModalOpen(true);
  };

  const handleCreateFolder = async (folderName: string) => {
    if (!user) throw new Error('Usuário não autenticado');

    // Determinar o ID da pasta pai buscando diretamente no banco
    let parentFolderId: string | null = null;
    if (currentPath !== '/') {
      const { data: parentFolderData, error: parentError } = await supabase
        .from('folders')
        .select('id')
        .eq('path', currentPath)
        .eq('user_id', user.id)
        .single(); // Espera encontrar exatamente uma pasta

      if (parentError || !parentFolderData) {
        console.error(`Erro ao buscar pasta pai para o caminho: ${currentPath}`, parentError);
        throw new Error(`Pasta pai não encontrada ou erro ao buscar: ${currentPath}`);
      }
      parentFolderId = parentFolderData.id;
    }

    // Construir o caminho completo da nova pasta
    const newFolderPath = `${currentPath}${folderName}/`;

    // Verificar se já existe uma pasta com o mesmo nome no mesmo local
    const { data: existingFolder, error: checkError } = await supabase
      .from('folders')
      .select('id')
      .eq('name', folderName)
      .eq('path', newFolderPath) // Verificar o caminho exato
      .eq('user_id', user.id)
      .maybeSingle(); // Usar maybeSingle para não dar erro se não encontrar

    if (checkError) {
      console.error('Erro ao verificar pasta existente:', checkError);
      throw checkError;
    }

    if (existingFolder) {
      throw new Error(`Uma pasta com o nome "${folderName}" já existe neste local.`);
    }

    // Inserir a nova pasta no banco de dados
    const { error: insertError } = await supabase
      .from('folders')
      .insert({
        id: uuidv4(), // Gerar um novo ID
        name: folderName,
        path: newFolderPath,
        parent_id: parentFolderId,
        user_id: user.id,
      });

    if (insertError) {
      console.error('Erro ao criar pasta no banco:', insertError);
      throw insertError;
    }

    // Recarregar a lista de arquivos/pastas
    await loadFiles();
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
          onCreateFolder={handleOpenCreateFolderModal} // Passar a função
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

      {/* Renderizar o modal */}
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onCreate={handleCreateFolder}
        currentPath={currentPath}
      />
    </div>
  );
}

export default App;
