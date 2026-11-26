/** Somente configurações públicas: todo VITE_* é incorporado ao JavaScript entregue ao navegador. */
export const env = Object.freeze({
  appName: import.meta.env.VITE_APP_NAME?.trim() || 'Control EP',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:4500',
  registerRoleId: import.meta.env.VITE_REGISTER_ROLE_ID?.trim() || '2',
});