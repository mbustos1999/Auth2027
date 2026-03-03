// Configuración: cambia esta URL por la de tu sitio WordPress
module.exports = {
  // Ejemplo: 'https://tudominio.com' (sin barra final)
  API_BASE_URL: process.env.AUTH_API_URL || 'https://argenmod.com',
  // Ruta del endpoint de login (ajusta si tu plugin usa otra)
  AUTH_ENDPOINT: '/wp-json/argenmod/v1/validar-login'
};
