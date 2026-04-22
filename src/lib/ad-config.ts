export const BANNER_HEIGHT = 60;

export const AD_CONFIG = {
  BANNER_HEIGHT,
  FULL_WIDTH: true,
  Z_INDEX: 9999,
  TOP_OFFSET: 0,
  BOTTOM_NAV_HEIGHT: 60,
} as const;

export const getBottomNavOffset = () => `${AD_CONFIG.BOTTOM_NAV_HEIGHT}px`;

export const getAppTopOffset = () => `${BANNER_HEIGHT + AD_CONFIG.TOP_OFFSET}px`;