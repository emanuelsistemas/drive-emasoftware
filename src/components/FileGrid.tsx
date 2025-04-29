import React, { useState } from 'react';
import { FileItem } from '../types';
import { formatFileSize } from '../utils/fileUtils';
// Adicionar Move icon
import { File, Folder, MoreVertical, Download, Trash2, Edit2, X, Check, AlertTriangle, Move } from 'lucide-react'; 
import { Menu, Dialog, Transition } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import JSZip from 'jszip';

interface FileGridProps {
  files: FileItem[];
  onItemClick: (item: FileItem) => void;
  onFileUpdate: () => void;
  onOpenMoveModal: (item: FileItem) => void; // Nova prop para abrir modal de mover
}

const FileGrid: React.FC<FileGridProps> = ({ files, onItemClick, onFileUpdate, onOpenMoveModal }) => {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getAllFilesInFolder = (folderId: string): FileItem[] => {
    const result: FileItem[] = [];
    
    // Get immediate files and folders
    const directItems = files.filter(item => item.parent === folderId);
    
    // Recursively get items from subfolders
    for (const item of directItems) {
      result.push(item);
      if (item.type === 'folder') {
        result.push(...getAllFilesInFolder(item.id));
      }
    }
    
    return result;
  };

  const handleDownload = async (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    setIsDownloading(true);
    
    try {
      if (item.type === 'file') {
        // Remove any leading slash from the path to prevent double slashes
        const storagePath = item.path.replace(/^\/+/, '');
        
        const { data } = await supabase.storage
          .from('files')
          .createSignedUrl(storagePath, 3600);

        if (data?.signedUrl) {
          const link = document.createElement('a');
          link.href = data.signedUrl;
          link.download = item.name;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } else {
        const zip = new JSZip();
        const folderFiles = getAllFilesInFolder(item.id);
        
        const downloadPromises = folderFiles
          .filter(file => file.type === 'file')
          .map(async (file) => {
            // Remove any leading slash from each file path
            const storagePath = file.path.replace(/^\/+/, '');
            
            const { data } = await supabase.storage
              .from('files')
              .createSignedUrl(storagePath, 3600);
            
            if (data?.signedUrl) {
              const response = await fetch(data.signedUrl);
              const blob = await response.blob();
              zip.file(file.name, blob);
            }
          });
        
        await Promise.all(downloadPromises);
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = window.URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${item.name}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const confirmDelete = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    setItemToDelete(item);
    setDeleteConfirmOpen(true);
  };

  const deleteFolderRecursively = async (folderId: string) => {
    try {
      console.log(`Starting recursive deletion of folder ID: ${folderId}`);
      
      // Primeiro, vamos buscar diretamente do banco de dados todos os arquivos e pastas relacionados
      // para garantir que temos a lista completa, independentemente do estado local
      
      // 1. Buscar todas as subpastas recursivamente
      let allSubfolders: any[] = [];
      let subfoldersError: Error | null = null;
      
      try {
        // Tentar usar a função RPC se existir
        const result = await supabase.rpc(
          'get_all_subfolders',
          { parent_folder_id: folderId }
        );
        
        if (result.error) {
          throw result.error;
        }
        
        allSubfolders = result.data || [];
      } catch (error) {
        console.log("RPC function not found or failed, using alternative query method");
        
        try {
          // Função RPC não existe, vamos usar uma abordagem alternativa
          // Primeiro, buscar a pasta atual para obter seu caminho
          const { data: currentFolder } = await supabase
            .from('folders')
            .select('path')
            .eq('id', folderId)
            .single();
            
          if (!currentFolder) {
            subfoldersError = new Error('Folder not found');
          } else {
            // Buscar todas as pastas cujo caminho começa com o caminho da pasta atual
            const { data, error } = await supabase
              .from('folders')
              .select('*')
              .like('path', `${currentFolder.path}%`)
              .neq('id', folderId); // Excluir a pasta atual
              
            if (error) {
              subfoldersError = error;
            } else {
              allSubfolders = data || [];
            }
          }
        } catch (e) {
          subfoldersError = e instanceof Error ? e : new Error('Unknown error fetching subfolders');
        }
      }
      
      if (subfoldersError) {
        console.error("Error fetching subfolders:", subfoldersError);
        throw subfoldersError;
      }
      
      // 2. Buscar todos os arquivos nas pastas (incluindo a pasta atual e subpastas)
      let allFolderIds = [folderId];
      if (allSubfolders && allSubfolders.length > 0) {
        allFolderIds = [...allFolderIds, ...allSubfolders.map((folder: any) => folder.id)];
      }
      
      console.log(`Found ${allFolderIds.length} folders to process (including target folder)`);
      
      const { data: allFiles, error: filesError } = await supabase
        .from('files')
        .select('*')
        .in('folder_id', allFolderIds);
        
      if (filesError) {
        console.error("Error fetching files:", filesError);
        throw filesError;
      }
      
      console.log(`Found ${allFiles?.length || 0} files to delete`);
      
      // 3. Listar todos os arquivos no storage para correspondência
      const allStorageFiles = await listAllStorageFiles('');
      const storageFileMap = new Map();
      
      // Criar um mapa para busca rápida
      for (const file of allStorageFiles) {
        storageFileMap.set(file.name.toLowerCase(), file.name);
        if (file.path) {
          storageFileMap.set(file.path.toLowerCase(), file.path);
        }
      }
      
      console.log(`Found ${allStorageFiles.length} files in storage`);
      
      // 4. Excluir todos os arquivos do storage
      if (allFiles && allFiles.length > 0) {
        console.log(`Deleting ${allFiles.length} files from storage and database`);
        
        // Excluir cada arquivo individualmente do storage
        for (const file of allFiles) {
          let fileDeleted = false;
          let matchedPath = null;
          
          // Tentar encontrar o arquivo no storage
          const normalizedName = file.name.toLowerCase();
          const normalizedPath = file.path.toLowerCase().replace(/^\/+/, '');
          
          // Verificar diferentes possibilidades de correspondência
          if (storageFileMap.has(normalizedName)) {
            matchedPath = storageFileMap.get(normalizedName);
          } else if (storageFileMap.has(normalizedPath)) {
            matchedPath = storageFileMap.get(normalizedPath);
          }
          
          if (matchedPath) {
            try {
              const { error: storageError } = await supabase.storage
                .from('files')
                .remove([matchedPath]);
                
              if (storageError) {
                console.error(`Failed to delete file from storage: ${matchedPath}`, storageError);
              } else {
                fileDeleted = true;
                console.log(`Successfully deleted file from storage: ${matchedPath}`);
              }
            } catch (err) {
              console.error(`Error deleting file from storage: ${matchedPath}`, err);
            }
          } else {
            // Tentar métodos alternativos
            const possiblePaths = [
              file.path,
              file.path?.replace(/^\/+/, ''),
              file.name
            ].filter(Boolean); // Remover valores nulos/undefined
            
            for (const path of possiblePaths) {
              try {
                const { error: storageError } = await supabase.storage
                  .from('files')
                  .remove([path]);
                  
                if (!storageError) {
                  fileDeleted = true;
                  console.log(`Successfully deleted file from storage using path: ${path}`);
                  break;
                }
              } catch (err) {
                // Continue tentando outros caminhos
              }
            }
          }
          
          if (!fileDeleted) {
            console.warn(`Could not delete file from storage: ${file.name} (ID: ${file.id})`);
          }
        }
        
        // 5. Excluir todos os arquivos do banco de dados
        const { error: dbFilesError } = await supabase
          .from('files')
          .delete()
          .in('id', allFiles.map(file => file.id));
          
        if (dbFilesError) {
          console.error("Error deleting files from database:", dbFilesError);
          throw dbFilesError;
        }
        
        console.log(`Successfully deleted ${allFiles.length} files from database`);
      }
      
      // 6. Excluir todas as subpastas do banco de dados (da mais profunda para a menos profunda)
      if (allSubfolders && allSubfolders.length > 0) {
        // Ordenar pastas por profundidade (da mais profunda para a menos profunda)
        const sortedFolders = [...allSubfolders].sort((a, b) => {
          const depthA = (a.path.match(/\//g) || []).length;
          const depthB = (b.path.match(/\//g) || []).length;
          return depthB - depthA;
        });
        
        console.log(`Deleting ${sortedFolders.length} subfolders`);
        
        for (const folder of sortedFolders) {
          const { error: folderError } = await supabase
            .from('folders')
            .delete()
            .eq('id', folder.id);
            
          if (folderError) {
            console.error(`Error deleting subfolder ${folder.id}:`, folderError);
            throw folderError;
          }
        }
        
        console.log(`Successfully deleted ${sortedFolders.length} subfolders`);
      }
      
      // 7. Finalmente, excluir a pasta principal
      console.log(`Deleting target folder: ${folderId}`);
      const { error: targetFolderError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);
        
      if (targetFolderError) {
        console.error("Error deleting target folder:", targetFolderError);
        throw targetFolderError;
      }
      
      console.log(`Successfully deleted target folder: ${folderId}`);
      
    } catch (error) {
      console.error('Error in recursive deletion:', error);
      throw error;
    }
  };

  // Helper function to recursively list all files in storage
  const listAllStorageFiles = async (path: string, allFiles: any[] = []): Promise<any[]> => {
    try {
      const { data: files, error } = await supabase.storage
        .from('files')
        .list(path, { sortBy: { column: 'name', order: 'asc' } });

      if (error) {
        throw error;
      }

      if (files && files.length > 0) {
        // Add the current path to each file object
        const processedFiles = files.map(file => ({
          ...file,
          path: path ? `${path}/${file.name}` : file.name
        }));
        
        // Add all non-folder files to our result
        const currentFiles = processedFiles.filter(file => !file.metadata?.mimetype?.includes('directory'));
        allFiles.push(...currentFiles);
        
        // Recursively process folders
        const folders = processedFiles.filter(file => file.metadata?.mimetype?.includes('directory'));
        for (const folder of folders) {
          const folderPath = path ? `${path}/${folder.name}` : folder.name;
          await listAllStorageFiles(folderPath, allFiles);
        }
      }

      return allFiles;
    } catch (error) {
      console.error(`Error listing storage at path "${path}":`, error);
      return allFiles; // Return what we have so far
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'file') {
        // First list all files in the bucket to find the exact match
        let storageDeleted = false;
        let matchedPath = null;
        
        try {
          // Get all files from the storage
          const allStorageFiles = await listAllStorageFiles('');
          console.log('Total files in storage:', allStorageFiles.length);
          
          // Look for a match by name or path
          const normalizedName = itemToDelete.name.toLowerCase();
          const normalizedPath = itemToDelete.path.toLowerCase().replace(/^\/+/, '');
          
          // Try to find a match by filename or path
          const foundByName = allStorageFiles.find(
            file => file.name.toLowerCase() === normalizedName
          );
          
          const foundByPath = allStorageFiles.find(
            file => file.path && file.path.toLowerCase() === normalizedPath
          );
          
          if (foundByPath) {
            matchedPath = foundByPath.path;
            console.log(`Found exact path match: "${matchedPath}"`);
          } else if (foundByName) {
            matchedPath = foundByName.path;
            console.log(`Found match by name: "${matchedPath}"`);
          } else {
            console.log('No exact match found in storage, will try alternative paths');
            
            // If we didn't find an exact match, dump a list of storage files for debugging
            console.log('Available files in storage:',
              allStorageFiles.map(f => ({ name: f.name, path: f.path }))
            );
          }
          
          if (matchedPath) {
            // Try to delete the matched file
            const { error: storageError } = await supabase.storage
              .from('files')
              .remove([matchedPath]);
              
            if (storageError) {
              console.error(`Failed to delete matched path "${matchedPath}":`, storageError);
            } else {
              console.log(`Successfully deleted "${matchedPath}" from storage`);
              storageDeleted = true;
            }
          }
        } catch (err) {
          console.error('Error listing or processing storage files:', err);
        }
        
        // If we couldn't find or delete the matched file, try the original fallback methods
        if (!storageDeleted) {
          console.log('Falling back to alternative deletion methods');
          
          const possiblePaths = [
            itemToDelete.path,                          // Original path
            itemToDelete.path.replace(/^\/+/, ''),      // Without leading slash
            itemToDelete.name                           // Just the filename
          ];
          
          for (const path of possiblePaths) {
            console.log(`Trying to delete using path: "${path}"`);
            
            if (!path) continue; // Skip empty paths
            
            try {
              const { error: storageError } = await supabase.storage
                .from('files')
                .remove([path]);
                
              if (storageError) {
                console.error(`Failed to delete using path "${path}":`, storageError);
              } else {
                console.log(`Successfully deleted using path "${path}"`);
                storageDeleted = true;
                break;
              }
            } catch (err) {
              console.error(`Error trying path "${path}":`, err);
            }
          }
        }
        
        if (!storageDeleted) {
          console.warn('Could not delete the file from storage, but proceeding with database deletion');
        }

        // Delete from database regardless of storage deletion success
        const { error: dbError } = await supabase
          .from('files')
          .delete()
          .eq('id', itemToDelete.id);

        if (dbError) {
          throw new Error(`Error deleting file from database: ${dbError.message}`);
        }
      } else if (itemToDelete.type === 'link') {
        // Para links, só precisamos excluir do banco de dados
        console.log(`Deleting link: ${itemToDelete.id} - ${itemToDelete.name}`);
        
        const { error: linkError } = await supabase
          .from('links')
          .delete()
          .eq('id', itemToDelete.id);

        if (linkError) {
          console.error('Error deleting link:', linkError);
          throw new Error(`Erro ao excluir link: ${linkError.message}`);
        }
        
        console.log('Link deleted successfully');
      } else {
        // É uma pasta
        await deleteFolderRecursively(itemToDelete.id);
      }
      
      onFileUpdate();
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting item:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const startRename = (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    setEditingItem(item.id);
    
    if (item.type === 'file') {
      const lastDotIndex = item.name.lastIndexOf('.');
      if (lastDotIndex > 0) {
        setNewName(item.name.substring(0, lastDotIndex));
      } else {
        setNewName(item.name);
      }
    } else {
      setNewName(item.name);
    }
  };

  const handleRename = async (e: React.MouseEvent, item: FileItem) => {
    e.stopPropagation();
    
    let finalName = newName;
    if (item.type === 'file') {
      const lastDotIndex = item.name.lastIndexOf('.');
      if (lastDotIndex > 0) {
        const extension = item.name.substring(lastDotIndex);
        finalName = newName + extension;
      }
    }

    if (finalName && finalName !== item.name) {
      try {
        if (item.type === 'file') {
          await supabase
            .from('files')
            .update({ name: finalName })
            .eq('id', item.id);
        } else {
          await supabase
            .from('folders')
            .update({ name: finalName })
            .eq('id', item.id);
        }
        onFileUpdate();
      } catch (error) {
        console.error('Error renaming item:', error);
      }
    }
    setEditingItem(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-4">
        {files.map((item) => (
          <div
            key={item.id}
            className="group relative flex flex-col items-center p-3 bg-gray-800 rounded-lg border border-gray-700 hover:bg-gray-700 cursor-pointer transition-all duration-200 transform hover:scale-105"
          >
            <Menu as="div" className="absolute top-2 right-2 z-10">
              <Menu.Button 
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-full hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical size={16} className="text-gray-400" />
              </Menu.Button>
              <Menu.Items 
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg"
              >
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`${
                        active ? 'bg-gray-700' : ''
                      } flex items-center w-full px-4 py-2 text-sm text-gray-300 disabled:opacity-50`}
                      onClick={(e) => handleDownload(e, item)}
                      disabled={isDownloading}
                    >
                      <Download size={16} className="mr-2" />
                      {isDownloading ? 'Baixando...' : 'Download'}
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`${
                        active ? 'bg-gray-700' : ''
                      } flex items-center w-full px-4 py-2 text-sm text-gray-300`}
                      onClick={(e) => startRename(e, item)}
                    >
                      <Edit2 size={16} className="mr-2" />
                      Renomear
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`${
                        active ? 'bg-gray-700' : ''
                      } flex items-center w-full px-4 py-2 text-sm text-red-400`}
                      onClick={(e) => confirmDelete(e, item)}
                    >
                      <Trash2 size={16} className="mr-2" />
                      Excluir
                    </button>
                  )}
                </Menu.Item>
                {/* Novo item de menu "Mover" */}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={`${
                        active ? 'bg-gray-700' : ''
                      } flex items-center w-full px-4 py-2 text-sm text-gray-300`}
                      onClick={(e) => {
                        e.stopPropagation(); // Impedir que o clique feche o menu ou navegue
                        onOpenMoveModal(item);
                      }}
                    >
                      <Move size={16} className="mr-2" />
                      Mover
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Menu>

            <div
              className="flex flex-col items-center justify-between w-full h-full"
              onClick={() => onItemClick(item)}
            >
              <div className="w-12 h-12 flex items-center justify-center text-gray-300">
                {item.type === 'folder' ? (
                  <Folder size={40} className="text-yellow-500" />
                ) : (
                  <File size={40} className="text-blue-400" />
                )}
              </div>
              
              <div className="w-full mt-2 flex flex-col items-center">
                {editingItem === item.id ? (
                  <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-1 py-0.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 text-center"
                      autoFocus
                    />
                    <button
                      onClick={(e) => handleRename(e, item)}
                      className="p-1 hover:bg-gray-600 rounded"
                    >
                      <Check size={14} className="text-green-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingItem(null);
                      }}
                      className="p-1 hover:bg-gray-600 rounded"
                    >
                      <X size={14} className="text-red-500" />
                    </button>
                  </div>
                ) : (
                  <div 
                    className="relative group/tooltip w-full"
                    title={item.name}
                  >
                    <p className="text-sm text-gray-200 font-medium text-center px-1 truncate">
                      {item.name}
                    </p>
                    <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-max max-w-xs bg-gray-900 text-gray-200 text-xs rounded px-2 py-1 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                      {item.name}
                    </div>
                  </div>
                )}
                {item.type === 'file' && (
                  <p className="text-xs text-gray-400 mt-1 text-center">{formatFileSize(item.size)}</p>
                )}
              </div>
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

      <Transition show={deleteConfirmOpen} as={React.Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setDeleteConfirmOpen(false)}
        >
          <div className="flex items-center justify-center min-h-screen">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black/50" />
            </Transition.Child>

            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="relative bg-gray-800 rounded-lg p-6 max-w-sm mx-4 w-full">
                <div className="flex items-center justify-center mb-4 text-yellow-500">
                  <AlertTriangle size={48} />
                </div>
                <Dialog.Title className="text-lg font-medium text-center text-gray-200 mb-4">
                  Confirmar exclusão
                </Dialog.Title>
                <div className="text-center mb-6 text-gray-300">
                  {itemToDelete?.type === 'folder' ? (
                    <p>
                      Tem certeza que deseja excluir a pasta "{itemToDelete?.name}" e todo seu conteúdo?
                      Esta ação não pode ser desfeita.
                    </p>
                  ) : (
                    <p>
                      Tem certeza que deseja excluir o arquivo "{itemToDelete?.name}"?
                      Esta ação não pode ser desfeita.
                    </p>
                  )}
                </div>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setDeleteConfirmOpen(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-200 transition-colors"
                    disabled={isDeleting}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default FileGrid;
