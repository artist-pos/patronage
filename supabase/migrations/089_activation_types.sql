-- 089: Admin-editable activation types for partner page carousel

CREATE TABLE IF NOT EXISTS public.activation_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  image_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO activation_types (title, description, sort_order) VALUES
  ('Construction hoardings', 'Commission artists for construction sites. 12–24 month visibility with QR-linked artist profiles.', 1),
  ('Billboards', 'Rotate emerging artists through high-visibility billboard networks with full impact reporting.', 2),
  ('Truck curtains', 'Turn fleet vehicles into moving galleries. Nationwide reach, artist commissions, impact tracked.', 3),
  ('Packaging', 'Artist work on cups, bags, receipts, and branded products. High-frequency activations.', 4),
  ('Public art', 'Permanent and temporary installations in civic spaces. Full pipeline from open call to reporting.', 5),
  ('Digital surfaces', 'Screens, projections, and digital displays in retail, transit, and public spaces.', 6);

ALTER TABLE activation_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active activation types"
  ON activation_types FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage activation types"
  ON activation_types FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner')));

-- Storage bucket for activation card images
INSERT INTO storage.buckets (id, name, public)
VALUES ('activation-images', 'activation-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read activation images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'activation-images');

CREATE POLICY "Admins can upload activation images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'activation-images' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );

CREATE POLICY "Admins can update activation images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'activation-images' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'owner'))
  );
