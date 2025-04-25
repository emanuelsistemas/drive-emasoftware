import React, { useState } from 'react';
import { Link } from 'lucide-react';

interface CreateLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (linkUrl: string, linkName: string) => Promise<void>;
  currentPath: string;
}

const CreateLinkModal: React.FC<CreateLinkModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  currentPath
}) => {
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!linkUrl.trim()) {
      setError('Por favor, insira um URL válido');
      return;
    }

    if (!linkName.trim()) {
      setError('Por favor, insira um nome para o link');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await onCreate(linkUrl, linkName);
      setLinkUrl('');
      setLinkName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Link size={20} />
            Criar Link
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            &times;
          </button>
        </div>
        
        <p className="text-gray-300 mb-4">
          Pasta atual: {currentPath}
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">Nome do Link</label>
            <input 
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="Exemplo: Documentação React"
              disabled={isLoading}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">URL</label>
            <input 
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              placeholder="https://exemplo.com"
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="mb-4 text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white flex items-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? 'Criando...' : 'Criar Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateLinkModal;
