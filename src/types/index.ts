export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'link';
  size?: number;
  lastModified?: Date;
  path: string;
  parent: string | null;
  url?: string; // URL para links externos
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
}