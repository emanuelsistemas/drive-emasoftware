-- Script SQL para criar a função RPC get_all_subfolders
-- Esta função busca recursivamente todas as subpastas de uma pasta específica

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

-- Exemplo de como chamar a função:
-- SELECT * FROM public.get_all_subfolders('seu-folder-id-aqui');
