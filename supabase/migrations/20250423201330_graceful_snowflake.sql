/*
  # Enable RLS and create security policies

  1. Changes
    - Enable RLS on `files` and `folders` tables
    - Add policies for authenticated users to:
      - Create their own files and folders
      - Read public files/folders
      - Read private files/folders they own
      - Update and delete their own files/folders

  2. Security
    - Authenticated users can only:
      - Create files/folders linked to their user_id
      - Read public files/folders
      - Read private files/folders they own
      - Update/delete files/folders they own
*/

-- Enable RLS on tables
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Files policies
CREATE POLICY "Users can create their own files"
ON files
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read public files"
ON files
FOR SELECT
TO authenticated
USING (
  (NOT is_private)
  OR
  (auth.uid() = user_id)
);

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

-- Folders policies
CREATE POLICY "Users can create their own folders"
ON folders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read public folders"
ON folders
FOR SELECT
TO authenticated
USING (
  (NOT is_private)
  OR
  (auth.uid() = user_id)
);

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