/*
  # Desabilitar RLS nas tabelas

  1. Alterações
    - Desabilitar RLS na tabela `files`
    - Desabilitar RLS na tabela `folders`
    - Remover políticas existentes
*/

-- Desabilitar RLS nas tabelas
ALTER TABLE files DISABLE ROW LEVEL SECURITY;
ALTER TABLE folders DISABLE ROW LEVEL SECURITY;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Users can create their own files" ON files;
DROP POLICY IF EXISTS "files_all_operations" ON files;
DROP POLICY IF EXISTS "files_select_policy" ON files;

DROP POLICY IF EXISTS "Users can create their own folders" ON folders;
DROP POLICY IF EXISTS "folders_all_operations" ON folders;
DROP POLICY IF EXISTS "folders_select_policy" ON folders;