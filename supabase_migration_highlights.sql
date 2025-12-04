-- Create highlights table for user profile audio showcases
CREATE TABLE IF NOT EXISTS highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  duration INTEGER NOT NULL, -- Duration in milliseconds
  bpm INTEGER,
  key TEXT,
  audio_type TEXT, -- vocals, drums, bass, guitar, keys, synth, fx, multiple, other
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON highlights(user_id);

-- Create index on user_id and order_index for ordered queries
CREATE INDEX IF NOT EXISTS idx_highlights_user_order ON highlights(user_id, order_index);

-- Enable RLS
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all highlights (public)
CREATE POLICY "Highlights are viewable by everyone"
  ON highlights
  FOR SELECT
  USING (true);

-- Policy: Users can insert their own highlights
CREATE POLICY "Users can insert their own highlights"
  ON highlights
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own highlights
CREATE POLICY "Users can update their own highlights"
  ON highlights
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own highlights
CREATE POLICY "Users can delete their own highlights"
  ON highlights
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add constraint to limit 5 highlights per user
CREATE OR REPLACE FUNCTION check_highlights_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM highlights WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 highlights allowed per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_highlights_limit
  BEFORE INSERT ON highlights
  FOR EACH ROW
  EXECUTE FUNCTION check_highlights_limit();

-- Update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION update_highlights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_highlights_timestamp
  BEFORE UPDATE ON highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_highlights_updated_at();
