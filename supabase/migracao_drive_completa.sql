-- Script de Migração Completo - Projeto Drive
-- Gerado em: 29/04/2025

-- =============================================
-- BLOCO 1: CONFIGURAÇÃO DE STORAGE BUCKETS
-- =============================================
BEGIN;
-- Verificar e criar bucket 'files' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'files') THEN
        INSERT INTO storage.buckets (id, name, public, avif_autodetection)
        VALUES ('files', 'files', true, false);
    END IF;
END
$$;

COMMIT;

-- =============================================
-- BLOCO 2: TABELAS DO SCHEMA PUBLIC
-- =============================================

-- Bloco 2.1: Criação da tabela de pastas (folders)
BEGIN;
CREATE TABLE IF NOT EXISTS public.folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    parent_id uuid REFERENCES public.folders(id),
    user_id uuid REFERENCES auth.users(id),
    path text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_private boolean DEFAULT false
);
COMMIT;

-- Bloco 2.2: Criação da tabela de arquivos (files)
BEGIN;
CREATE TABLE IF NOT EXISTS public.files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    folder_id uuid REFERENCES public.folders(id),
    user_id uuid REFERENCES auth.users(id),
    size bigint DEFAULT 0,
    type text NOT NULL,
    path text NOT NULL,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_private boolean DEFAULT false
);
COMMIT;

-- Bloco 2.3: Criação da tabela de links
BEGIN;
CREATE TABLE IF NOT EXISTS public.links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    url text NOT NULL,
    path text NOT NULL,
    folder_id uuid REFERENCES public.folders(id),
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
COMMIT;

-- =============================================
-- BLOCO 3: CONFIGURAÇÃO DE ROW LEVEL SECURITY (RLS)
-- =============================================
BEGIN;
-- Habilitar RLS para todas as tabelas
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;
COMMIT;

-- =============================================
-- BLOCO 4: POLÍTICAS DE SEGURANÇA (RLS POLICIES)
-- =============================================

-- Bloco 4.1: Políticas para a tabela 'folders'
BEGIN;
-- Políticas para pastas (folders)
CREATE POLICY "Users can read their own folders" 
ON public.folders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" 
ON public.folders FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own folders" 
ON public.folders FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" 
ON public.folders FOR DELETE 
USING (auth.uid() = user_id);

COMMIT;

-- Bloco 4.2: Políticas para a tabela 'files'
BEGIN;
-- Políticas para arquivos (files)
CREATE POLICY "Users can read their own files" 
ON public.files FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files" 
ON public.files FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own files" 
ON public.files FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" 
ON public.files FOR DELETE 
USING (auth.uid() = user_id);

COMMIT;

-- Bloco 4.3: Políticas para a tabela 'links'
BEGIN;
-- Política para links (política única para todas as operações)
CREATE POLICY "links_policy" 
ON public.links FOR ALL 
USING (auth.uid() = user_id);

COMMIT;

-- =============================================
-- BLOCO 5: FUNÇÕES DE ATUALIZAÇÃO AUTOMÁTICA
-- =============================================
BEGIN;
-- Função para atualizar o timestamp 'updated_at'
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMIT;

-- =============================================
-- BLOCO 6: TRIGGERS
-- =============================================
BEGIN;
-- Trigger para atualizar timestamp em 'folders'
DROP TRIGGER IF EXISTS update_folders_timestamp ON public.folders;
CREATE TRIGGER update_folders_timestamp
BEFORE UPDATE ON public.folders
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Trigger para atualizar timestamp em 'files'
DROP TRIGGER IF EXISTS update_files_timestamp ON public.files;
CREATE TRIGGER update_files_timestamp
BEFORE UPDATE ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();

-- Trigger para atualizar timestamp em 'links'
DROP TRIGGER IF EXISTS update_links_timestamp ON public.links;
CREATE TRIGGER update_links_timestamp
BEFORE UPDATE ON public.links
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp();
COMMIT;

-- =============================================
-- BLOCO 7: VERIFICAÇÃO DE INTEGRIDADE
-- =============================================
BEGIN;
DO $$
DECLARE
    missing_tables boolean := false;
    missing_policies boolean := false;
    missing_functions boolean := false;
    missing_buckets boolean := false;
BEGIN
    -- Verificar tabelas
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'folders') THEN
        RAISE WARNING 'Tabela public.folders não encontrada!';
        missing_tables := true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'files') THEN
        RAISE WARNING 'Tabela public.files não encontrada!';
        missing_tables := true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'links') THEN
        RAISE WARNING 'Tabela public.links não encontrada!';
        missing_tables := true;
    END IF;
    
    -- Verificar bucket
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'files') THEN
        RAISE WARNING 'Bucket storage.files não encontrado!';
        missing_buckets := true;
    END IF;
    
    -- Verificar função
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_timestamp') THEN
        RAISE WARNING 'Função update_timestamp não encontrada!';
        missing_functions := true;
    END IF;
    
    -- Verificar políticas
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'folders' AND policyname = 'Users can read their own folders') THEN
        RAISE WARNING 'Política "Users can read their own folders" não encontrada!';
        missing_policies := true;
    END IF;
    
    -- Decisão final
    IF missing_tables OR missing_policies OR missing_functions OR missing_buckets THEN
        RAISE EXCEPTION 'A migração não foi concluída com sucesso. Verifique os avisos acima.';
    ELSE
        RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
        RAISE NOTICE 'Todas as estruturas foram criadas corretamente.';
    END IF;
END
$$;
COMMIT;
