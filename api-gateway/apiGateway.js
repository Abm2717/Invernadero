/**
 * API GATEWAY
 * 
 * Responsabilidades:
 * 1. Recibir todas las peticiones del Frontend
 * 2. Enrutarlas al microservicio correspondiente
 * 3. Punto de entrada único para el cliente
 * 
 * Rutas:
 *   /sensores/*       → Servicio Sensores     (puerto 8001)
 *   /notificaciones/* → Servicio Notificaciones (puerto 8002)
 */

const express    = require('express');
const cors       = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const HTTP_PORT = 9000;

const app = express();
app.use(cors());

const servicios = {
  '/sensores':       'http://localhost:8001/sensores',
  '/notificaciones': 'http://localhost:8002/notificaciones'
};

app.use((req, res, next) => {
  console.log(`[GATEWAY] ${req.method} ${req.path} → enrutando...`);
  next();
});

app.use('/sensores', createProxyMiddleware({
  target: servicios['/sensores'],
  changeOrigin: true,
  proxyTimeout: 10000,
  timeout: 10000,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`[GATEWAY] → Servicio Sensores | ${req.method} ${req.originalUrl}`);
    },
    error: (err, req, res) => {
      console.error(`[GATEWAY] Error al conectar con Servicio Sensores: ${err.message}`);
      res.status(503).json({ error: 'Servicio Sensores no disponible' });
    }
  }
}));

app.use('/notificaciones', createProxyMiddleware({
  target: servicios['/notificaciones'],
  changeOrigin: true,
  proxyTimeout: 10000,
  timeout: 10000,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`[GATEWAY] → Servicio Notificaciones | ${req.method} ${req.originalUrl}`);
    },
    error: (err, req, res) => {
      console.error(`[GATEWAY] Error al conectar con Servicio Notificaciones: ${err.message}`);
      res.status(503).json({ error: 'Servicio Notificaciones no disponible' });
    }
  }
}));

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    servicios,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.path} no encontrada en el Gateway` });
});

app.listen(HTTP_PORT, () => {
  console.log(`[GATEWAY] API Gateway corriendo en http://localhost:${HTTP_PORT}`);
  console.log(`[GATEWAY] Rutas disponibles:`);
  console.log(`           /status`);
  console.log(`           /sensores/*       → http://localhost:8001`);
  console.log(`           /notificaciones/* → http://localhost:8002`);
});