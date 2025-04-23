import React, { useState } from 'react';
import { FileItem } from '../types';
import { formatFileSize } from '../utils/fileUtils';
import { File, Folder, MoreVertical, Download, Trash2, Edit2, X, Check, AlertTriangle } from 'lucide-react';
import { Menu, Dialog, Transition } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import JSZip from 'jszip';

interface FileGridProps {
  files: FileItem[];
  onItemClick: (item: FileItem) => void;
  onFileUpdate: () => void;
}

const FileGrid: React.FC<FileGridProps> = ({ files, onItemClick, onFileUpdate }) => {
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
      const allItems = getAllFilesInFolder(folderId);
      
      // Group items by type and depth
      const fileItems = allItems.filter(item => item.type === 'file');
      const folderItems = allItems
        .filter(item => item.type === 'folder')
        .sort((a, b) => {
          // Sort by path depth (descending) to delete deepest folders first
          const depthA = (a.path.match(/\//g) || []).length;
          const depthB = (b.path.match(/\//g) || []).length;
          return depthB - depthA;
        });

      // Delete all files first from storage
      if (fileItems.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('files')
          .remove(fileItems.map(file => file.path));

        if (storageError) {
          throw new Error(`Error deleting files from storage: ${storageError.message}`);
        }

        // Delete files from database after successful storage deletion
        const { error: dbError } = await supabase
          .from('files')
          .delete()
          .in('id', fileItems.map(file => file.id));

        if (dbError) {
          throw new Error(`Error deleting files from database: ${dbError.message}`);
        }
      }

      // Delete folders from deepest to shallowest
      for (const folder of folderItems) {
        const { error: folderError } = await supabase
          .from('folders')
          .delete()
          .eq('id', folder.id);

        if (folderError) {
          throw new Error(`Error deleting folder: ${folderError.message}`);
        }
      }

      // Finally delete the target folder
      const { error: targetFolderError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (targetFolderError) {
        throw new Error(`Error deleting target folder: ${targetFolderError.message}`);
      }

    } catch (error) {
      console.error('Error in recursive deletion:', error);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'file') {
        // Delete from storage first
        const { error: storageError } = await supabase.storage
          .from('files')
          .remove([itemToDelete.path]);

        if (storageError) {
          throw new Error(`Error deleting file from storage: ${storageError.message}`);
        }

        // Delete from database after successful storage deletion
        const { error: dbError } = await supabase
          .from('files')
          .delete()
          .eq('id', itemToDelete.id);

        if (dbError) {
          throw new Error(`Error deleting file from database: ${dbError.message}`);
        }
      } else {
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