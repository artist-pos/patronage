-- Links a blog post to the studio update that was auto-created from it.
-- Prevents duplicate updates if the post is re-published/saved.
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS linked_update_id uuid REFERENCES project_updates(id) ON DELETE SET NULL;
