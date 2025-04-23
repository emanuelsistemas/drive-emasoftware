export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  lastModified?: Date;
  path: string;
  parent: string | null;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
}