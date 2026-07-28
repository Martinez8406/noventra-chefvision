export function navigateToPublicDish(params: {
  userId: string;
  dishId: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
}): void {
  const { userId, dishId, usePathRouting, onPathChange } = params;
  const encodedDishId = encodeURIComponent(dishId);
  const menuBasePath = `/menu/${userId}`;
  const menuBaseHash = `#/menu/${userId}`;

  if (usePathRouting) {
    history.pushState({}, '', `${menuBasePath}/dish/${encodedDishId}`);
    onPathChange?.();
    return;
  }

  window.location.hash = `${menuBaseHash}/dish/${encodedDishId}`;
}

export function navigateToPublicMenuList(params: {
  userId: string;
  usePathRouting?: boolean;
  onPathChange?: () => void;
}): void {
  const { userId, usePathRouting, onPathChange } = params;
  const menuBasePath = `/menu/${userId}`;
  const menuBaseHash = `#/menu/${userId}`;

  if (usePathRouting) {
    history.pushState({}, '', menuBasePath);
    onPathChange?.();
    return;
  }

  window.location.hash = menuBaseHash;
}
