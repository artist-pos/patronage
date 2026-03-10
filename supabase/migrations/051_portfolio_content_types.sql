-- Add multi-content-type support to portfolio_images
ALTER TABLE portfolio_images
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'image'
    CHECK (content_type IN ('image', 'audio', 'video', 'text', 'document', 'embed')),
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS text_content text;
