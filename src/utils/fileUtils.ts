import { FileItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';

export const processFiles = async (fileList: FileList | null, currentPath: string = '/'): Promise<FileItem[]> => {
  if (!fileList) return [];

  const items: FileItem[] = [];
  const processPromises: Promise<void>[] = [];
  const folderCache = new Map<string, string>();

  for (const file of Array.from(fileList)) {
    const relativePath = file.webkitRelativePath || file.name;
    const pathParts = relativePath.split('/').filter(Boolean);
    const fileName = pathParts.pop() || file.name;

    if (pathParts.length > 0) {
      let currentParent = null;
      let currentPathBuilt = currentPath;

      // Process each folder in the path
      for (const folder of pathParts) {
        currentPathBuilt += folder + '/';
        
        // Check if we've already processed this folder path
        const cachedFolderId = folderCache.get(currentPathBuilt);
        if (cachedFolderId) {
          currentParent = cachedFolderId;
          continue;
        }

        // Check if folder exists in database
        const { data: existingFolders } = await supabase
          .from('folders')
          .select('id, parent_id')
          .eq('name', folder)
          .eq('path', currentPathBuilt)
          .limit(1);

        const existingFolder = existingFolders && existingFolders.length > 0 ? existingFolders[0] : null;

        if (existingFolder) {
          currentParent = existingFolder.id;
          folderCache.set(currentPathBuilt, existingFolder.id);
        } else {
          // Create new folder
          const folderId = uuidv4();
          const { data: newFolder } = await supabase
            .from('folders')
            .insert({
              id: folderId,
              name: folder,
              path: currentPathBuilt,
              parent_id: currentParent,
              user_id: (await supabase.auth.getUser()).data.user?.id
            })
            .select()
            .single();

          if (newFolder) {
            items.push({
              id: newFolder.id,
              name: folder,
              type: 'folder',
              path: currentPathBuilt,
              parent: currentParent,
            });
            currentParent = newFolder.id;
            folderCache.set(currentPathBuilt, newFolder.id);
          }
        }
      }

      // Process the file within its folder
      processPromises.push(uploadFile(file, fileName, currentPathBuilt, currentParent, items));
    } else {
      // Process root-level file
      processPromises.push(uploadFile(file, fileName, currentPath, null, items));
    }
  }

  await Promise.all(processPromises);
  return items;
};

const uploadFile = async (
  file: File,
  fileName: string,
  path: string,
  parentId: string | null,
  items: FileItem[]
): Promise<void> => {
  const fileId = uuidv4();
  const userId = (await supabase.auth.getUser()).data.user?.id;
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  const storagePath = `${userId}/${path}${fileName}`;
  
  // Upload do arquivo para o Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('files')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    console.error('Erro ao fazer upload:', uploadError);
    return;
  }

  // Criar registro no banco de dados
  const { data: fileData, error: dbError } = await supabase
    .from('files')
    .insert({
      id: fileId,
      name: fileName,
      path: path + fileName,
      size: file.size,
      type: file.type,
      url: uploadData?.path || '',
      folder_id: parentId,
      user_id: userId
    })
    .select()
    .single();

  if (dbError) {
    console.error('Erro ao salvar no banco:', dbError);
    return;
  }

  if (fileData) {
    items.push({
      id: fileData.id,
      name: fileName,
      type: 'file',
      size: file.size,
      path: path + fileName,
      parent: parentId,
    });
  }
};

export const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined) return '';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export const generateBreadcrumbs = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  const breadcrumbs = [
    { id: 'root', name: 'Início', path: '/' }
  ];
  
  let currentPath = '/';
  parts.forEach(part => {
    currentPath += part + '/';
    breadcrumbs.push({
      id: part,
      name: part,
      path: currentPath
    });
  });
  
  return breadcrumbs;
};