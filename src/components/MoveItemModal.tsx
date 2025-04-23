import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Move, X, Folder as FolderIcon, ChevronRight, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FileItem } from '../types'; // Assumindo que FileItem inclui pastas

interface MoveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToMove: FileItem | null;
  onMoveConfirm: (destinationFolderId: string | null) => Promise<void>; // null para mover para a raiz
  userId: string | undefined; // ID do usuário para buscar pastas
}

interface FolderStructureItem {
  id: string;
  name: string;
  path: string;
  parent_id: string | null;
}

const MoveItemModal: React.FC<MoveItemModalProps> = ({
  isOpen,
  onClose,
  itemToMove,
  onMoveConfirm,
  userId,
}) => {
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null); // null representa a raiz
  const [currentNavPath, setCurrentNavPath] = useState<FolderStructureItem[]>([]); // Para navegação no modal
  const [foldersInCurrentView, setFoldersInCurrentView] = useState<FolderStructureItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca pastas com base no parent_id atual para navegação
  const fetchFolders = async (parentId: string | null) => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const query = supabase
        .from('folders')
        .select('id, name, path, parent_id')
        .eq('user_id', userId);

      if (parentId === null) {
        query.is('parent_id', null); // Pastas na raiz
      } else {
        query.eq('parent_id', parentId); // Pastas dentro de outra pasta
      }

      const { data, error: fetchError } = await query.order('name');

      if (fetchError) throw fetchError;

      // Filtrar para não mostrar a pasta que está sendo movida ou suas subpastas
      // (Implementação simplificada: apenas não mostra a própria pasta)
      const filteredData = data?.filter(folder => folder.id !== itemToMove?.id) || [];
      setFoldersInCurrentView(filteredData);

    } catch (err) {
      console.error('Error fetching folders for move modal:', err);
      setError('Erro ao carregar pastas.');
      setFoldersInCurrentView([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Efeito para carregar pastas quando o modal abre ou a navegação muda
  useEffect(() => {
    if (isOpen && userId) {
      const currentParentId = currentNavPath.length > 0 ? currentNavPath[currentNavPath.length - 1].id : null;
      fetchFolders(currentParentId);
    } else {
      // Resetar estado quando o modal fecha
      setCurrentNavPath([]);
      setFoldersInCurrentView([]);
      setTargetFolderId(null);
      setError(null);
    }
  }, [isOpen, currentNavPath, userId]);

  const handleNavigate = (folder: FolderStructureItem) => {
    setCurrentNavPath([...currentNavPath, folder]);
    setTargetFolderId(folder.id); // Pré-seleciona a pasta em que entramos
  };

  const handleNavigateBack = (index: number) => {
    const newPath = currentNavPath.slice(0, index + 1);
    setCurrentNavPath(newPath);
    setTargetFolderId(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
  };

  const handleNavigateToRoot = () => {
    setCurrentNavPath([]);
    setTargetFolderId(null); // Seleciona a raiz
  };

  const handleConfirmMove = async () => {
    if (!itemToMove) return;
    // Impedir mover para dentro de si mesmo (simplificado)
    if (itemToMove.type === 'folder' && targetFolderId === itemToMove.id) {
        setError('Não é possível mover uma pasta para dentro dela mesma.');
        return;
    }
    // Impedir mover para a pasta atual
    if (itemToMove.parent === targetFolderId) {
        setError('O item já está nesta pasta.');
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onMoveConfirm(targetFolderId);
      onClose(); // Fechar modal após sucesso
    } catch (err) {
      console.error('Error moving item:', err);
      setError(err instanceof Error ? err.message : 'Erro ao mover item.');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (!itemToMove) return 'Mover';
    const targetName = targetFolderId === null
      ? 'raiz'
      : currentNavPath.length > 0
      ? currentNavPath[currentNavPath.length - 1].name
      : 'destino desconhecido';
    return `Mover "${itemToMove.name}" para ${targetName}`;
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 overflow-y-auto" onClose={onClose}>
        {/* ... Overlay ... */}
         <div className="flex items-center justify-center min-h-screen">
           <Transition.Child
             as={Fragment}
             enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
             leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
           >
             <Dialog.Overlay className="fixed inset-0 bg-black/50" />
           </Transition.Child>

           <Transition.Child
             as={Fragment}
             enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
             leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
           >
             <div className="relative bg-gray-800 rounded-lg p-6 max-w-md mx-4 w-full">
               <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-200" disabled={isLoading}>
                 <X size={20} />
               </button>

               <Dialog.Title className="text-lg font-medium text-gray-200 mb-4 flex items-center gap-2">
                 <Move size={20} /> Mover Item
               </Dialog.Title>
               <p className="text-sm text-gray-400 mb-4">
                 Selecione a pasta de destino para <strong className="text-gray-200">{itemToMove?.name}</strong>:
               </p>

               {/* Navegação de Pastas */}
               <div className="bg-gray-700 rounded p-3 mb-4 h-60 overflow-y-auto">
                 {/* Breadcrumbs da Navegação Interna */}
                 <div className="flex items-center text-sm text-gray-400 mb-2 flex-wrap">
                   <button onClick={handleNavigateToRoot} className={`hover:text-gray-200 ${targetFolderId === null ? 'font-bold text-white' : ''}`}>
                     <Home size={16} className="inline mr-1" /> Raiz
                   </button>
                   {currentNavPath.map((folder, index) => (
                     <Fragment key={folder.id}>
                       <ChevronRight size={16} className="mx-1" />
                       <button
                         onClick={() => handleNavigateBack(index)}
                         className={`hover:text-gray-200 ${targetFolderId === folder.id ? 'font-bold text-white' : ''}`}
                       >
                         {folder.name}
                       </button>
                     </Fragment>
                   ))}
                 </div>

                 {/* Lista de Pastas */}
                 {isLoading ? (
                   <p className="text-gray-400 text-center">Carregando pastas...</p>
                 ) : foldersInCurrentView.length === 0 ? (
                   <p className="text-gray-400 text-center">Nenhuma subpasta encontrada.</p>
                 ) : (
                   <ul className="space-y-1">
                     {foldersInCurrentView.map((folder) => (
                       <li key={folder.id}>
                         <button
                           onClick={() => handleNavigate(folder)}
                           className="flex items-center justify-between w-full text-left px-2 py-1 rounded hover:bg-gray-600 text-gray-300"
                         >
                           <span className="flex items-center gap-2">
                             <FolderIcon size={16} className="text-yellow-500" />
                             {folder.name}
                           </span>
                           <ChevronRight size={16} />
                         </button>
                       </li>
                     ))}
                   </ul>
                 )}
               </div>

               {error && (
                 <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
               )}

               <div className="flex justify-end gap-3">
                 <button
                   onClick={onClose}
                   className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-200 transition-colors"
                   disabled={isLoading}
                 >
                   Cancelar
                 </button>
                 <button
                   onClick={handleConfirmMove}
                   disabled={isLoading}
                   className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors disabled:opacity-50"
                 >
                   {isLoading ? 'Movendo...' : getButtonText()}
                 </button>
               </div>
             </div>
           </Transition.Child>
         </div>
      </Dialog>
    </Transition>
  );
};

export default MoveItemModal;
