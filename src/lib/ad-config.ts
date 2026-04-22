export const AD_CONFIG = {
  BANNER_HEIGHT: 50,
  FULL_WIDTH: true,
  Z_INDEX: 9999,
  TOP_OFFSET: 0,
  BOTTOM_NAV_HEIGHT: 60,
} as const;

export const getBottomNavOffset = () =>
  `calc(${AD_CONFIG.BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;

export const getAppTopOffset = () =>
  `calc(var(--safe-top, 0px) + var(--ad-banner-height, 0px) + ${AD_CONFIG.TOP_OFFSET}px)`;