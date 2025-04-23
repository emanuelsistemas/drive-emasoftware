-- Script SQL para implementar a solução de exclusão de arquivos no Storage do Supabase
-- Este script cria as funções e triggers necessários para garantir que os arquivos sejam
-- excluídos tanto da tabela do banco de dados quanto do storage

-- 1. Função para excluir arquivos do storage quando excluídos da tabela public.files
CREATE OR REPLACE FUNCTION public.delete_file_from_storage()
RETURNS TRIGGER AS $$
DECLARE
  storage_path TEXT;
  file_exists BOOLEAN;
BEGIN
  -- Verificar se o arquivo existe no storage com o caminho exato
  SELECT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'files' AND name = OLD.path
  ) INTO file_exists;
  
  IF file_exists THEN
    -- Se o arquivo existe com o caminho exato, excluí-lo
    DELETE FROM storage.objects
    WHERE bucket_id = 'files' AND name = OLD.path;
    
    RAISE NOTICE 'Arquivo excluído do storage com o caminho exato: %', OLD.path;
  ELSE
    -- Tentar encontrar o arquivo com o caminho sem barras iniciais
    storage_path := REGEXP_REPLACE(OLD.path, '^/+', '');
    
    SELECT EXISTS (
      SELECT 1 FROM storage.objects 
      WHERE bucket_id = 'files' AND name = storage_path
    ) INTO file_exists;
    
    IF file_exists THEN
      -- Se o arquivo existe com o caminho sem barras iniciais, excluí-lo
      DELETE FROM storage.objects
      WHERE bucket_id = 'files' AND name = storage_path;
      
      RAISE NOTICE 'Arquivo excluído do storage com o caminho sem barras iniciais: %', storage_path;
    ELSE
      -- Tentar encontrar o arquivo apenas pelo nome do arquivo
      storage_path := SUBSTRING(OLD.path FROM '([^/]+)$');
      
      IF storage_path IS NOT NULL AND storage_path != '' THEN
        SELECT EXISTS (
          SELECT 1 FROM storage.objects 
          WHERE bucket_id = 'files' AND name LIKE '%' || storage_path
        ) INTO file_exists;
        
        IF file_exists THEN
          -- Se o arquivo existe com o nome do arquivo, excluí-lo
          DELETE FROM storage.objects
          WHERE bucket_id = 'files' AND name LIKE '%' || storage_path;
          
          RAISE NOTICE 'Arquivo excluído do storage com o nome do arquivo: %', storage_path;
        ELSE
          RAISE NOTICE 'Arquivo não encontrado no storage: %', OLD.path;
        END IF;
      ELSE
        RAISE NOTICE 'Não foi possível extrair o nome do arquivo do caminho: %', OLD.path;
      END IF;
    END IF;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger para acionar a função quando um arquivo é excluído
DROP TRIGGER IF EXISTS delete_file_from_storage_trigger ON public.files;

CREATE TRIGGER delete_file_from_storage_trigger
AFTER DELETE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.delete_file_from_storage();

-- 3. Função para limpar arquivos órfãos no storage
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_storage_files()
RETURNS TABLE (file_name TEXT, deleted BOOLEAN) AS $$
DECLARE
  storage_file RECORD;
  file_exists BOOLEAN;
  file_paths TEXT[];
  orphaned_files_count INTEGER := 0;
BEGIN
  -- Obter todos os caminhos de arquivos na tabela public.files
  SELECT ARRAY_AGG(path) INTO file_paths FROM public.files;
  
  -- Se não houver arquivos na tabela, definir como array vazio
  IF file_paths IS NULL THEN
    file_paths := '{}';
  END IF;
  
  -- Iterar sobre todos os arquivos no storage
  FOR storage_file IN
    SELECT id, name FROM storage.objects WHERE bucket_id = 'files'
  LOOP
    -- Verificar se o arquivo existe na tabela public.files
    file_exists := FALSE;
    
    -- Verificar o caminho exato
    IF storage_file.name = ANY(file_paths) THEN
      file_exists := TRUE;
    END IF;
    
    -- Verificar o caminho sem barras iniciais
    IF NOT file_exists THEN
      FOR i IN 1..array_length(file_paths, 1) LOOP
        IF file_paths[i] IS NOT NULL AND REGEXP_REPLACE(file_paths[i], '^/+', '') = storage_file.name THEN
          file_exists := TRUE;
          EXIT;
        END IF;
      END LOOP;
    END IF;
    
    -- Se o arquivo não existe na tabela public.files, excluí-lo do storage
    IF NOT file_exists THEN
      orphaned_files_count := orphaned_files_count + 1;
      
      -- Excluir o arquivo do storage
      DELETE FROM storage.objects WHERE id = storage_file.id;
      
      -- Retornar o nome do arquivo e o status de exclusão
      file_name := storage_file.name;
      deleted := TRUE;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  -- Se nenhum arquivo órfão foi encontrado, retornar uma mensagem
  IF orphaned_files_count = 0 THEN
    file_name := 'Nenhum arquivo órfão encontrado';
    deleted := FALSE;
    RETURN NEXT;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Exemplo de como executar a função de limpeza
-- SELECT * FROM public.cleanup_orphaned_storage_files();
