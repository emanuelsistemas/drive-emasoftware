# Documentação: Solução para Exclusão Recursiva de Pastas

## Problema

O aplicativo Drive apresentava um problema na exclusão de pastas: não era possível excluir uma pasta se ela contivesse arquivos ou subpastas. A exclusão só funcionava para pastas vazias. O objetivo era permitir que, ao solicitar a exclusão de uma pasta, todo o seu conteúdo (arquivos e subpastas) fosse excluído recursivamente.

## Diagnóstico

1.  **Análise do Banco de Dados**:
    *   Verificamos as restrições de chave estrangeira nas tabelas `public.files` e `public.folders`.
    *   Identificamos a restrição `files_folder_id_fkey` na tabela `files`, que referencia a coluna `id` da tabela `folders`. Essa restrição impede a exclusão de uma pasta se houver arquivos dentro dela (ou em suas subpastas) que a referenciam.
    *   Identificamos a restrição `folders_parent_id_fkey` na tabela `folders`, que referencia a coluna `id` da própria tabela `folders`. Isso impede a exclusão de uma pasta se houver subpastas que a referenciam.

2.  **Análise do Código**:
    *   Analisamos a função `deleteFolderRecursively` no arquivo `FileGrid.tsx`.
    *   A lógica inicial tentava obter a lista de arquivos e subpastas a partir do estado local (`files`), o que poderia estar incompleto.
    *   A ordem de exclusão (arquivos primeiro, depois subpastas, depois a pasta principal) estava correta, mas a implementação precisava ser mais robusta para lidar com as restrições do banco de dados e garantir que todos os itens fossem buscados diretamente do banco.

## Solução Implementada

### 1. Função RPC `get_all_subfolders`

Para obter de forma confiável todas as subpastas de uma pasta, criamos uma função SQL recursiva no banco de dados:

```sql
CREATE OR REPLACE FUNCTION public.get_all_subfolders(parent_folder_id UUID)
RETURNS SETOF public.folders AS $$
WITH RECURSIVE folder_tree AS (
  -- Base case: start with the immediate children of the parent folder
  SELECT f.*
  FROM public.folders f
  WHERE f.parent_id = parent_folder_id
  
  UNION ALL
  
  -- Recursive case: get children of each folder in the tree
  SELECT f.*
  FROM public.folders f
  JOIN folder_tree ft ON f.parent_id = ft.id
)
SELECT * FROM folder_tree;
$$ LANGUAGE SQL STABLE;
```

Esta função utiliza uma Common Table Expression (CTE) recursiva para percorrer a árvore de pastas a partir de um `parent_folder_id` e retornar todas as subpastas encontradas.

### 2. Atualização da Função `deleteFolderRecursively`

A função `deleteFolderRecursively` no arquivo `FileGrid.tsx` foi significativamente refatorada para:

1.  **Buscar Dados Diretamente do Banco**:
    *   Chamar a função RPC `get_all_subfolders` para obter a lista completa de IDs de todas as subpastas.
    *   Buscar diretamente na tabela `public.files` todos os arquivos que pertencem à pasta principal ou a qualquer uma de suas subpastas.

2.  **Excluir Arquivos (Storage e Banco)**:
    *   Iterar sobre a lista de arquivos obtida.
    *   Para cada arquivo, tentar excluí-lo do Supabase Storage usando várias estratégias de correspondência de caminho (caminho exato, caminho sem barra inicial, apenas nome do arquivo).
    *   Após tentar a exclusão do storage (registrando avisos em caso de falha), excluir todos os arquivos da tabela `public.files` em uma única operação.

3.  **Excluir Pastas (Banco)**:
    *   Iterar sobre a lista de subpastas obtida (ordenada da mais profunda para a menos profunda).
    *   Excluir cada subpasta da tabela `public.folders`.
    *   Finalmente, excluir a pasta principal (a que foi solicitada para exclusão) da tabela `public.folders`.

4.  **Tratamento de Erros e Logs**: Adicionados logs detalhados em cada etapa para facilitar a depuração e tratamento de erros aprimorado.

5.  **Correções de TypeScript**: Corrigidos erros de tipo que surgiram durante a refatoração.

### Resumo da Lógica de Exclusão Atualizada:

```typescript
// Dentro de deleteFolderRecursively(folderId)

// 1. Obter todas as subpastas via RPC ou query alternativa
const allSubfolders = await supabase.rpc('get_all_subfolders', { parent_folder_id: folderId }) // ou query alternativa

// 2. Obter todos os IDs de pastas (principal + subpastas)
const allFolderIds = [folderId, ...allSubfolders.map(f => f.id)];

// 3. Obter todos os arquivos dentro dessas pastas
const allFiles = await supabase.from('files').select('*').in('folder_id', allFolderIds);

// 4. Tentar excluir arquivos do Storage (com logs)
// ... (lógica para tentar excluir cada 'file' de 'allFiles' do storage)

// 5. Excluir todos os arquivos da tabela 'files'
await supabase.from('files').delete().in('id', allFiles.map(f => f.id));

// 6. Excluir todas as subpastas da tabela 'folders' (ordenadas)
// ... (loop para excluir cada 'folder' de 'allSubfolders' ordenados)

// 7. Excluir a pasta principal da tabela 'folders'
await supabase.from('folders').delete().eq('id', folderId);
```

## Conclusão

A nova implementação da função `deleteFolderRecursively`, juntamente com a função RPC `get_all_subfolders`, garante que a exclusão de pastas funcione corretamente, mesmo quando elas contêm subitens. A abordagem busca os dados diretamente do banco de dados e respeita a ordem necessária para lidar com as restrições de chave estrangeira, tornando a operação mais robusta e confiável.
