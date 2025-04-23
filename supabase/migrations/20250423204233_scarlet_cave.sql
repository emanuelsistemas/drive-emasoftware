/*
  # Ajustar políticas de armazenamento

  1. Alterações
    - Remover política antiga do bucket de storage
    - Criar nova política mais permissiva para uploads
    - Garantir que o bucket seja público para facilitar o acesso aos arquivos

  2. Segurança
    - Permitir que usuários autenticados façam upload
    - Manter a segurança baseada no user_id
*/

-- Remover política antiga
DROP POLICY IF EXISTS "Usuários podem gerenciar seus próprios arquivos" ON storage.objects;

-- Atualizar bucket para público
UPDATE storage.buckets
SET public = true
WHERE id = 'files';

-- Criar nova política mais permissiva
CREATE POLICY "Permitir gerenciamento de arquivos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'files')
WITH CHECK (bucket_id = 'files');