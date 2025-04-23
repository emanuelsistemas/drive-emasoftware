/*
  # Ajustes no esquema do banco de dados

  1. Alterações
    - Adicionar bucket de storage para arquivos
    - Ajustar políticas de RLS para permitir upload de arquivos
    - Garantir que usuários só possam acessar seus próprios arquivos

  2. Segurança
    - Usuários só podem ver e manipular seus próprios arquivos
    - Upload de arquivos permitido apenas para usuários autenticados
*/

-- Criar bucket de storage se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

-- Criar política para o bucket de storage
CREATE POLICY "Usuários podem gerenciar seus próprios arquivos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Ajustar políticas das tabelas
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can read their files or public files" ON files;
DROP POLICY IF EXISTS "Users can update their own files" ON files;
DROP POLICY IF EXISTS "Users can delete their own files" ON files;
DROP POLICY IF EXISTS "Allow file uploads with session or user_id" ON files;

DROP POLICY IF EXISTS "Users can create their own folders" ON folders;
DROP POLICY IF EXISTS "Users can read public folders" ON folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;

-- Criar novas políticas
CREATE POLICY "Usuários podem criar seus próprios arquivos"
ON files
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem ver seus próprios arquivos"
ON files
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios arquivos"
ON files
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios arquivos"
ON files
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Políticas para pastas
CREATE POLICY "Usuários podem criar suas próprias pastas"
ON folders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem ver suas próprias pastas"
ON folders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias pastas"
ON folders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias pastas"
ON folders
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);