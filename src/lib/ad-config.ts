// Block 4: Yandex / AdMob banners are STRICT 320x50 standard size.
// Z-index dropped to 10 so the chat Header (z-10 within its own stacking
// context but on top via DOM order) and any modals/toasts always win
// pointer events over the ad container.
export const BANNER_HEIGHT = 50;

export const AD_CONFIG = {
  BANNER_HEIGHT,
  BANNER_WIDTH: 320,
  FULL_WIDTH: false,
  Z_INDEX: 10,
  TOP_OFFSET: 0,
  BOTTOM_NAV_HEIGHT: 60,
} as const;

export const getBottomNavOffset = () => `${AD_CONFIG.BOTTOM_NAV_HEIGHT}px`;

export const getAppTopOffset = () => `${BANNER_HEIGHT + AD_CONFIG.TOP_OFFSET}px`;
