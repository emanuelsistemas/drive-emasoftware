# Documentação: Solução para Exclusão de Arquivos no Storage do Supabase

## Problema

O aplicativo Drive apresentava um problema na exclusão de arquivos: quando um arquivo era excluído da tabela `public.files` no banco de dados, o arquivo físico correspondente não era excluído do storage do Supabase (bucket `files`). Isso resultava em arquivos "órfãos" no storage, ocupando espaço desnecessariamente e potencialmente causando problemas de gerenciamento de recursos.

## Diagnóstico

1. **Análise do Banco de Dados**:
   - Verificamos que havia registros na tabela `storage.objects` (arquivos físicos) sem correspondência na tabela `public.files` (registros do aplicativo)
   - Confirmamos que o código do aplicativo estava excluindo corretamente os registros da tabela `public.files`, mas falhando ao excluir os arquivos do storage

2. **Análise do Código**:
   - No arquivo `FileGrid.tsx`, o código tentava excluir o arquivo do storage usando:
     ```typescript
     const { error: storageError, data } = await supabase.storage
       .from('files')
       .remove([itemToDelete.path]);
     ```
   - O problema estava no formato do caminho (`itemToDelete.path`) que não correspondia exatamente ao formato esperado pelo storage

3. **Análise do Storage**:
   - No storage, os arquivos são armazenados com um caminho que inclui o ID do usuário, por exemplo: `d8806c76-71bd-4354-8cae-21fbfec9df79/14-04.jpeg`
   - O caminho armazenado na tabela `public.files` nem sempre correspondia exatamente ao caminho no storage, causando falhas na exclusão

## Solução Implementada

### 1. Limpeza Imediata

Primeiro, excluímos manualmente os arquivos órfãos existentes no storage:

```sql
DELETE FROM storage.objects 
WHERE bucket_id = 'files' AND name = 'd8806c76-71bd-4354-8cae-21fbfec9df79/14-04.jpeg';
```

### 2. Trigger para Exclusão Automática

Criamos um trigger no banco de dados que é acionado automaticamente quando um arquivo é excluído da tabela `public.files`. Este trigger tenta várias estratégias para encontrar e excluir o arquivo correspondente no storage:

```sql
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

CREATE TRIGGER delete_file_from_storage_trigger
AFTER DELETE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.delete_file_from_storage();
```

Este trigger:
- Tenta encontrar e excluir o arquivo do storage usando o caminho exato
- Se não encontrar, tenta com o caminho sem barras iniciais
- Se ainda não encontrar, tenta usando apenas o nome do arquivo
- Registra mensagens detalhadas para facilitar a depuração

### 3. Função de Limpeza para Arquivos Órfãos

Criamos uma função que pode ser executada periodicamente para identificar e excluir arquivos órfãos no storage:

```sql
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
```

Esta função:
- Obtém todos os caminhos de arquivos na tabela `public.files`
- Itera sobre todos os arquivos no storage
- Verifica se cada arquivo do storage tem correspondência na tabela `public.files`
- Exclui os arquivos órfãos e retorna informações sobre os arquivos excluídos

## Como Usar a Solução

### Exclusão Normal de Arquivos

Com o trigger implementado, a exclusão de arquivos agora funciona automaticamente:

1. Quando um arquivo é excluído da tabela `public.files` (seja pelo código do aplicativo ou diretamente no banco de dados), o trigger `delete_file_from_storage_trigger` é acionado
2. O trigger executa a função `delete_file_from_storage()` que tenta várias estratégias para encontrar e excluir o arquivo do storage
3. O arquivo é excluído tanto da tabela quanto do storage

### Limpeza de Arquivos Órfãos

Para limpar arquivos órfãos existentes no storage:

1. Execute a função `cleanup_orphaned_storage_files()`:
   ```sql
   SELECT * FROM public.cleanup_orphaned_storage_files();
   ```

2. A função retornará uma tabela com os nomes dos arquivos excluídos e o status da exclusão

## Considerações Técnicas

### Segurança

As funções foram criadas com a cláusula `SECURITY DEFINER`, o que significa que elas são executadas com os privilégios do usuário que as criou, garantindo que tenham permissão para excluir arquivos do storage.

### Desempenho

- O trigger é executado apenas quando um arquivo é excluído da tabela `public.files`, então não afeta o desempenho de outras operações
- A função `cleanup_orphaned_storage_files()` pode ser pesada se houver muitos arquivos no storage, então deve ser executada em horários de baixo tráfego

### Manutenção

É recomendável executar a função `cleanup_orphaned_storage_files()` periodicamente (por exemplo, uma vez por semana) para garantir que não haja acúmulo de arquivos órfãos no storage.

## Conclusão

Esta solução resolve o problema de exclusão de arquivos no projeto Drive, garantindo que os arquivos sejam excluídos tanto da tabela do banco de dados quanto do storage do Supabase. A implementação é robusta e tenta várias estratégias para encontrar e excluir os arquivos, mesmo que os caminhos não correspondam exatamente.

A solução também fornece uma ferramenta para limpar arquivos órfãos existentes, o que é útil para manutenção do sistema e economia de espaço no storage.
