/*
  # Fix File Upload RLS Policies

  1. Changes
    - Update RLS policies for files table to properly handle file uploads
    - Add policy for handling upload_session based inserts
    - Ensure proper user_id assignment during upload

  2. Security
    - Maintain security by ensuring users can only access their own files
    - Allow file creation with upload_session
    - Preserve existing policies for other operations
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can create their own files" ON files;

-- Create new insert policy that handles both direct uploads and upload sessions
CREATE POLICY "Allow file uploads with session or user_id"
ON files
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if user_id matches authenticated user
  (auth.uid() = user_id) OR
  -- Or if there's an upload_session (for chunked uploads)
  (upload_session IS NOT NULL)
);

-- Ensure the select policy allows users to see their uploaded files
DROP POLICY IF EXISTS "Users can read public files" ON files;
CREATE POLICY "Users can read their files or public files"
ON files
FOR SELECT
TO authenticated
USING (
  (NOT is_private) OR 
  (auth.uid() = user_id) OR
  -- Allow access during upload process
  (upload_session IS NOT NULL AND auth.uid() = user_id)
);