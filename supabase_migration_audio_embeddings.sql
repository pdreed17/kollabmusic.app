-- Migration: Audio Embeddings for Similarity Search
-- Creates table to store audio feature embeddings and support similarity queries

-- ============================================================================
-- Create audio_embeddings table
-- ============================================================================

CREATE TABLE IF NOT EXISTS audio_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audio_file_id UUID NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- 64-dimensional embedding vector
  embedding FLOAT8[] NOT NULL,

  -- Original audio features (stored as JSONB for flexibility)
  features JSONB NOT NULL,
  -- Example features structure:
  -- {
  --   "bpm": 120,
  --   "key": "C",
  --   "mfcc": [1.2, -0.5, ...],
  --   "chroma": [0.8, 0.3, ...],
  --   "spectralCentroid": 2500,
  --   "energy": 0.65
  -- }

  -- Audio metadata
  duration FLOAT NOT NULL, -- seconds
  sample_rate INTEGER NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_audio_embeddings_audio_file_id ON audio_embeddings(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_audio_embeddings_user_id ON audio_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_embeddings_project_id ON audio_embeddings(project_id);
CREATE INDEX IF NOT EXISTS idx_audio_embeddings_created_at ON audio_embeddings(created_at DESC);

-- GIN index for JSONB features (allows fast queries on features.bpm, features.key, etc.)
CREATE INDEX IF NOT EXISTS idx_audio_embeddings_features ON audio_embeddings USING GIN (features);

-- ============================================================================
-- Enable Row Level Security
-- ============================================================================

ALTER TABLE audio_embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Users can view embeddings for:
-- 1. Their own recordings
-- 2. Public projects
-- 3. Projects they collaborate on
DROP POLICY IF EXISTS "Users can view relevant embeddings" ON audio_embeddings;
CREATE POLICY "Users can view relevant embeddings"
  ON audio_embeddings FOR SELECT
  USING (
    user_id = auth.uid() OR
    project_id IS NULL OR
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = audio_embeddings.project_id
      AND (
        projects.is_public = true OR
        EXISTS (
          SELECT 1 FROM project_collaborators
          WHERE project_collaborators.project_id = projects.id
          AND project_collaborators.user_id = auth.uid()
        )
      )
    )
  );

-- Users can create embeddings for their own audio files
DROP POLICY IF EXISTS "Users can create embeddings for their audio" ON audio_embeddings;
CREATE POLICY "Users can create embeddings for their audio"
  ON audio_embeddings FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM audio_files
      WHERE audio_files.id = audio_embeddings.audio_file_id
      AND audio_files.created_by = auth.uid()
    )
  );

-- Users can update their own embeddings
DROP POLICY IF EXISTS "Users can update their own embeddings" ON audio_embeddings;
CREATE POLICY "Users can update their own embeddings"
  ON audio_embeddings FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete their own embeddings
DROP POLICY IF EXISTS "Users can delete their own embeddings" ON audio_embeddings;
CREATE POLICY "Users can delete their own embeddings"
  ON audio_embeddings FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_audio_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_audio_embeddings_updated_at ON audio_embeddings;
CREATE TRIGGER update_audio_embeddings_updated_at
  BEFORE UPDATE ON audio_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_audio_embeddings_updated_at();

-- ============================================================================
-- Similarity Search Function (using cosine similarity)
-- ============================================================================

-- Note: For production with large datasets, consider using pgvector extension
-- This is a simple SQL implementation for MVP

CREATE OR REPLACE FUNCTION cosine_similarity(a FLOAT8[], b FLOAT8[])
RETURNS FLOAT8 AS $$
DECLARE
  dot_product FLOAT8 := 0;
  magnitude_a FLOAT8 := 0;
  magnitude_b FLOAT8 := 0;
  i INTEGER;
BEGIN
  -- Check if arrays have same length
  IF array_length(a, 1) != array_length(b, 1) THEN
    RAISE EXCEPTION 'Array length mismatch';
  END IF;

  -- Calculate dot product and magnitudes
  FOR i IN 1..array_length(a, 1) LOOP
    dot_product := dot_product + (a[i] * b[i]);
    magnitude_a := magnitude_a + (a[i] * a[i]);
    magnitude_b := magnitude_b + (b[i] * b[i]);
  END LOOP;

  magnitude_a := sqrt(magnitude_a);
  magnitude_b := sqrt(magnitude_b);

  -- Avoid division by zero
  IF magnitude_a = 0 OR magnitude_b = 0 THEN
    RETURN 0;
  END IF;

  RETURN dot_product / (magnitude_a * magnitude_b);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Search similar audio function
-- ============================================================================

CREATE OR REPLACE FUNCTION search_similar_audio(
  query_embedding FLOAT8[],
  query_user_id UUID,
  result_limit INTEGER DEFAULT 10,
  min_similarity FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  audio_file_id UUID,
  file_name TEXT,
  similarity_score FLOAT8,
  bpm FLOAT,
  key TEXT,
  energy FLOAT,
  username TEXT,
  display_name TEXT,
  project_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.audio_file_id,
    af.file_name,
    cosine_similarity(ae.embedding, query_embedding) as similarity_score,
    (ae.features->>'bpm')::FLOAT as bpm,
    ae.features->>'key' as key,
    (ae.features->>'energy')::FLOAT as energy,
    u.username,
    u.display_name,
    p.title as project_title,
    ae.created_at
  FROM audio_embeddings ae
  JOIN audio_files af ON af.id = ae.audio_file_id
  JOIN users u ON u.id = ae.user_id
  LEFT JOIN projects p ON p.id = ae.project_id
  WHERE
    ae.user_id != query_user_id AND
    cosine_similarity(ae.embedding, query_embedding) >= min_similarity
  ORDER BY similarity_score DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE audio_embeddings IS 'Audio feature embeddings for similarity search and recommendation';
COMMENT ON COLUMN audio_embeddings.embedding IS '64-dimensional feature vector (MFCC + Chroma + spectral features)';
COMMENT ON COLUMN audio_embeddings.features IS 'Original extracted features: BPM, key, MFCCs, chroma, spectral centroid, energy';
COMMENT ON FUNCTION search_similar_audio IS 'Find similar audio files using cosine similarity on embeddings';

-- ============================================================================
-- Example Queries
-- ============================================================================

/*
-- Insert an embedding:
INSERT INTO audio_embeddings (audio_file_id, user_id, project_id, embedding, features, duration, sample_rate)
VALUES (
  'audio-file-uuid',
  'user-uuid',
  'project-uuid',
  ARRAY[0.1, 0.2, ...], -- 64 dimensions
  '{"bpm": 120, "key": "C", "energy": 0.65}'::JSONB,
  180.5,
  44100
);

-- Search for similar audio:
SELECT * FROM search_similar_audio(
  ARRAY[0.1, 0.2, ...], -- query embedding
  'user-uuid', -- exclude this user's recordings
  10, -- limit
  0.6 -- min similarity
);

-- Query by BPM range:
SELECT * FROM audio_embeddings
WHERE (features->>'bpm')::FLOAT BETWEEN 115 AND 125;

-- Query by key:
SELECT * FROM audio_embeddings
WHERE features->>'key' = 'C';
*/
