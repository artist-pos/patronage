/** A row of `activation_types`: the surface kinds shown as activation tiles
 *  (hoardings, billboards, truck curtains…). Previously exported from the old
 *  /partners page; lives here so components don't import from a route file. */
export type ActivationType = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};
