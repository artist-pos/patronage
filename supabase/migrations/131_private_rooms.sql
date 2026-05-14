CREATE TABLE IF NOT EXISTS private_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  slug text NOT NULL,
  show_prices boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (artist_profile_id, slug)
);

CREATE TABLE IF NOT EXISTS private_room_artworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES private_rooms(id) ON DELETE CASCADE NOT NULL,
  artwork_id uuid REFERENCES artworks(id) ON DELETE CASCADE NOT NULL,
  position integer DEFAULT 0,
  UNIQUE (room_id, artwork_id)
);

ALTER TABLE private_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_room_artworks ENABLE ROW LEVEL SECURITY;

-- Anyone with the URL can view active rooms
CREATE POLICY "private_rooms_public_read" ON private_rooms
  FOR SELECT USING (is_active = true);

-- Artist manages their own rooms
CREATE POLICY "private_rooms_artist_manage" ON private_rooms
  FOR ALL USING (artist_profile_id = auth.uid());

-- Anyone can read artworks in an active room (slug acts as access token)
CREATE POLICY "private_room_artworks_public_read" ON private_room_artworks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM private_rooms r
      WHERE r.id = room_id AND r.is_active = true
    )
  );

-- Artist manages artworks in their own rooms
CREATE POLICY "private_room_artworks_artist_manage" ON private_room_artworks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM private_rooms r
      WHERE r.id = room_id AND r.artist_profile_id = auth.uid()
    )
  );
