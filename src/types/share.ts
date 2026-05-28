export type ShareType = 'work' | 'update' | 'support' | 'profile' | 'blog'
export type ShareTemplate = 'dark' | 'light' | 'warm' | 'slate'
export type ShareFormat = 'story' | 'post'

export interface ShareImageOption {
  url: string;
  label: string;
}

export interface SharePayload {
  type: ShareType
  title: string
  sub: string
  price: string | null
  tag: string
  handle: string
  imageUrl: string | null
  shareUrl: string
  editionCount?: number | null
  imageOptions?: ShareImageOption[]
}
