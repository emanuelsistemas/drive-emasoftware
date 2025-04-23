/*
  # Recriar tabelas do projeto

  1. Alterações
    - Remover tabelas existentes
    - Criar novas tabelas files e folders
    - Remover RLS das tabelas
    - Configurar storage bucket público
*/

-- Remover tabelas existentes
DROP TABLE IF EXISTS files;
DROP TABLE IF EXISTS folders;

-- Criar tabela de pastas
CREATE TABLE folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES folders(id),
  user_id uuid REFERENCES auth.users(id),
  path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de arquivos
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  folder_id uuid REFERENCES folders(id),
  user_id uuid REFERENCES auth.users(id),
  size bigint DEFAULT 0,
  type text NOT NULL,
  path text NOT NULL,
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Desabilitar RLS nas tabelas
ALTER TABLE folders DISABLE ROW LEVEL SECURITY;
ALTER TABLE files DISABLE ROW LEVEL SECURITY;

-- Configurar bucket de storage público
UPDATE storage.buckets
SET public = true
WHERE id = 'files';

-- Remover políticas antigas do storage
DROP POLICY IF EXISTS "Permitir gerenciamento de arquivos" ON storage.objects;

-- Criar política permissiva para o storage
CREATE POLICY "Acesso total ao storage"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'files')
WITH CHECK (bucket_id = 'files');