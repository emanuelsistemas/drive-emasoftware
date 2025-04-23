/*
  # Add is_private column to files table

  1. Changes
    - Add `is_private` column to `files` table with boolean type and default value of false
    - Add `is_private` column to `folders` table with boolean type and default value of false
    - Enable RLS on both tables for security
    - Add policies for authenticated users to manage their own files and folders

  2. Security
    - Enable RLS on files and folders tables
    - Add policies for authenticated users to:
      - Read their own files/folders
      - Create new files/folders
      - Update their own files/folders
      - Delete their own files/folders
*/

-- Add is_private column to files table
ALTER TABLE files 
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Add is_private column to folders table
ALTER TABLE folders 
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Enable RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Policies for files table
CREATE POLICY "Users can read their own files"
  ON files
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own files"
  ON files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files"
  ON files
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files"
  ON files
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for folders table
CREATE POLICY "Users can read their own folders"
  ON folders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders"
  ON folders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON folders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON folders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);