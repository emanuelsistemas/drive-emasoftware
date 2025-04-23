import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    onSearch(query);
  }, [query, onSearch]);

  const handleClear = () => {
    setQuery('');
  };

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <div className="absolute left-3 text-gray-400">
          <Search size={18} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar arquivos..."
          className="w-full bg-gray-800 border border-gray-700 py-2 pl-10 pr-10 rounded-md text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 text-gray-400 hover:text-gray-200"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;