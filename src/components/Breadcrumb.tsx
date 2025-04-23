import React from 'react';
import { BreadcrumbItem } from '../types';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate }) => {
  return (
    <div className="flex items-center flex-wrap my-4 px-1">
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <div
            onClick={() => onNavigate(item.path)}
            className="flex items-center cursor-pointer text-sm hover:text-blue-400 transition-colors text-gray-300"
          >
            {index === 0 ? (
              <Home size={16} className="mr-1" />
            ) : null}
            <span>{item.name}</span>
          </div>
          {index < items.length - 1 && (
            <ChevronRight size={16} className="mx-2 text-gray-500" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default Breadcrumb;