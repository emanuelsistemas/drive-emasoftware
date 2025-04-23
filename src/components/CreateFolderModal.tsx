import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { FolderPlus, X } from 'lucide-react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (folderName: string) => Promise<void>;
  currentPath: string; // Para saber onde criar a pasta
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  currentPath,
}) => {
  const [folderName, setFolderName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!folderName.trim()) {
      setError('O nome da pasta não pode estar vazio.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await onCreate(folderName.trim());
      setFolderName(''); // Limpar campo após sucesso
      onClose(); // Fechar modal após sucesso
    } catch (err) {
      console.error('Error creating folder:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar pasta.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return; // Não fechar se estiver carregando
    setFolderName(''); // Limpar campo ao fechar
    setError(null);
    onClose();
  };

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-50 overflow-y-auto"
        onClose={handleClose}
      >
        <div className="flex items-center justify-center min-h-screen">
          <Transition.Child
            as={Fragment}
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
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="relative bg-gray-800 rounded-lg p-6 max-w-sm mx-4 w-full">
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-200"
                disabled={isLoading}
              >
                <X size={20} />
              </button>

              <div className="flex items-center justify-center mb-4 text-blue-500">
                <FolderPlus size={48} />
              </div>
              <Dialog.Title className="text-lg font-medium text-center text-gray-200 mb-4">
                Criar Nova Pasta
              </Dialog.Title>
              <p className="text-sm text-gray-400 mb-4 text-center">
                Digite o nome da nova pasta a ser criada em: <code className="bg-gray-700 px-1 rounded">{currentPath}</code>
              </p>

              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="Nome da pasta"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
                disabled={isLoading}
              />

              {error && (
                <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
              )}

              <div className="flex justify-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-200 transition-colors"
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isLoading || !folderName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Criando...' : 'Criar Pasta'}
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CreateFolderModal;
