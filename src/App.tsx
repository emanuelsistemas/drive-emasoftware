import { useState, useEffect, useCallback } from 'react';
import { FileItem } from './types';
import { processFiles, generateBreadcrumbs } from './utils/fileUtils';
import Breadcrumb from './components/Breadcrumb';
import FileGrid from './components/FileGrid';
import ActionBar from './components/ActionBar';
import Auth from './components/Auth';
import CreateFolderModal from './components/CreateFolderModal';
import CreateLinkModal from './components/CreateLinkModal';
import MoveItemModal from './components/MoveItemModal'; // Importar modal de mover
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [isCreateLinkModalOpen, setIsCreateLinkModalOpen] = useState(false);
  const [isMoveItemModalOpen, setIsMoveItemModalOpen] = useState(false); // Estado do modal de mover
  const [itemToMove, setItemToMove] = useState<FileItem | null>(null); // Item a ser movido
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
        
      // Buscar os links
      const { data: linksData, error: linksError } = await supabase
        .from('links')
        .select('*')
        .eq('user_id', user.id);
        
      if (linksError) throw linksError;

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
        })),
        ...(linksData || []).map(link => ({
          id: link.id,
          name: link.name,
          type: 'link' as const,
          path: link.path,
          parent: link.folder_id,
          url: link.url
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
    } else if (item.type === 'link') {
      // Abrir o link em uma nova aba/janela
      window.open(item.url, '_blank');
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
  
  const handleOpenCreateLinkModal = () => {
    setIsCreateLinkModalOpen(true);
  };

  const handleCreateLink = async (linkUrl: string, linkName: string) => {
    if (!user) return;

    try {
      // Determinar o ID da pasta pai (ou null se estiver na raiz)
      let parentFolderId: string | null = null;
      
      if (currentPath !== '/') {
        const { data: parentFolder, error } = await supabase
          .from('folders')
          .select('id')
          .eq('path', currentPath)
          .eq('user_id', user.id)
          .single();
          
        if (error) {
          console.error('Erro ao encontrar pasta pai:', error);
          throw new Error('Não foi possível encontrar a pasta atual.');
        }
        
        if (parentFolder) {
          parentFolderId = parentFolder.id;
        }
      }
      
      // Criar um ID único para o link
      const linkId = uuidv4();
      
      // Determinar o nome do arquivo (com extensão .link)
      const fullLinkName = linkName.endsWith('.link') ? linkName : `${linkName}.link`;
      
      // Criar o registro do link no banco de dados
      const { error: insertError } = await supabase
        .from('links')
        .insert({
          id: linkId,
          name: fullLinkName,
          url: linkUrl,
          path: currentPath,
          folder_id: parentFolderId,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Erro ao criar link:', insertError);
        throw new Error('Não foi possível criar o link.');
      }
      
      console.log('Link criado com sucesso!');
      await loadFiles(); // Recarregar os arquivos
      setIsCreateLinkModalOpen(false); // Fechar o modal
      
    } catch (error) {
      console.error('Erro ao criar link:', error);
      throw error;
    }
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

  // Funções para o modal de mover
  const handleOpenMoveModal = (item: FileItem) => {
    setItemToMove(item);
    setIsMoveItemModalOpen(true);
  };

  const handleCloseMoveModal = () => {
    setIsMoveItemModalOpen(false);
    setItemToMove(null);
  };

  const handleMoveItem = async (destinationFolderId: string | null) => {
    if (!itemToMove || !user) throw new Error('Item ou usuário inválido');

    console.log(`Tentando mover ${itemToMove.type} "${itemToMove.name}" para pasta ID: ${destinationFolderId ?? 'raiz'}`);

    // Obter informações da pasta de destino
    let destinationPath = '/';
    if (destinationFolderId) {
      const { data: destFolderData, error: destError } = await supabase
        .from('folders')
        .select('path')
        .eq('id', destinationFolderId)
        .single();
      if (destError || !destFolderData) {
        throw new Error('Pasta de destino não encontrada.');
      }
      destinationPath = destFolderData.path;
    }

    try {
      if (itemToMove.type === 'file') {
        // Mover arquivo

        // Garantir que destinationPath termine com / se não for a raiz
        const normalizedDestinationPath = destinationPath === '/' ? '' : (destinationPath.endsWith('/') ? destinationPath : destinationPath + '/');
        
        // Caminho antigo no storage (como está no DB, que deve incluir user_id)
        const oldDbPath = itemToMove.path; 
        // Novo caminho no storage (construído com base no destino)
        const newStoragePath = `${user.id}/${normalizedDestinationPath}${itemToMove.name}`; 
        // Novo caminho para salvar no DB (igual ao novo storage path)
        const newDbPath = newStoragePath; // Caminho a ser salvo no DB (igual ao novo storage path)

        // Usar os caminhos completos (com user_id) para a API de storage,
        // pois o RLS parece depender disso e o path no DB já os inclui.
        const oldStoragePathFull = oldDbPath;
        const newStoragePathFull = newDbPath;

        console.log(`Tentando mover no storage de: "${oldStoragePathFull}" para: "${newStoragePathFull}"`);
        console.log(`Caminho antigo no DB: "${oldDbPath}"`);
        console.log(`Novo caminho no DB: "${newDbPath}"`);

        // 1. Mover no Storage usando caminhos completos
        const { error: moveError } = await supabase.storage
          .from('files')
          .move(oldStoragePathFull, newStoragePathFull);
          
        if (moveError) {
           // Log detalhado do erro
           console.error(`Erro ao mover no storage: ${moveError.message}`, {
             oldPath: oldStoragePathFull,
             newPath: newStoragePathFull,
             oldDbPath: oldDbPath,
             newDbPath: newDbPath,
             originalError: moveError
           });
           // Lançar o erro para o usuário
           throw new Error(`Erro ao mover arquivo no storage: ${moveError.message}`);
        }

        // 2. Atualizar no Banco de Dados
        const { error: updateError } = await supabase
          .from('files')
          .update({
            folder_id: destinationFolderId,
            path: newDbPath, // Atualizar o caminho no DB
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemToMove.id);

        if (updateError) {
          console.error("Erro ao atualizar arquivo no banco:", updateError);
          // Idealmente, tentar reverter a movimentação no storage aqui
          throw updateError;
        }

      } else {
        // Mover pasta - Requer função RPC complexa
        console.log("Movendo pasta:", itemToMove.id, "para:", destinationFolderId);
        const { error: rpcError } = await supabase.rpc('move_folder_recursive', {
            folder_to_move_id: itemToMove.id,
            new_parent_folder_id: destinationFolderId,
            user_id_param: user.id // Passar user_id se a função RPC precisar
        });

        if (rpcError) {
            console.error("Erro ao chamar RPC move_folder_recursive:", rpcError);
            throw rpcError;
        }
      }

      console.log("Item movido com sucesso!");
      await loadFiles(); // Recarregar arquivos

    } catch (error) {
       console.error("Falha ao mover item:", error);
       // Re-throw para que o modal possa exibir o erro
       throw error;
    }
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
          onCreateFolder={handleOpenCreateFolderModal}
          onCreateLink={handleOpenCreateLinkModal}
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
          onOpenMoveModal={handleOpenMoveModal} // Passar a função para abrir modal
        />
      </main>

      {/* Renderizar os modais */}
      <CreateFolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onCreate={handleCreateFolder}
        currentPath={currentPath}
      />
      <CreateLinkModal
        isOpen={isCreateLinkModalOpen}
        onClose={() => setIsCreateLinkModalOpen(false)}
        onCreate={handleCreateLink}
        currentPath={currentPath}
      />
      <MoveItemModal
        isOpen={isMoveItemModalOpen}
        onClose={handleCloseMoveModal}
        itemToMove={itemToMove}
        onMoveConfirm={handleMoveItem}
        userId={user?.id}
      />
    </div>
  );
}

export default App;
