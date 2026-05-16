/**
 * API GATEWAY con autenticación Keycloak
 * 
 * Responsabilidades:
 * 1. Validar token JWT de Keycloak en cada petición
 * 2. Enrutar peticiones autenticadas al microservicio correspondiente
 * 
 * Rutas:
 *   /sensores/*       → Servicio Sensores     (puerto 8001)
 *   /notificaciones/* → Servicio Notificaciones (puerto 8002)
 */

const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { createProxyMiddleware } = require('http-proxy-middleware');

const HTTP_PORT = 9000;

// ---------------------------------------------------------
// Configuración de Keycloak
// ---------------------------------------------------------
const KEYCLOAK_URL   = 'http://localhost:8080';
const REALM          = 'Invernadero';
const JWKS_URI       = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`;

const client = jwksClient({ jwksUri: JWKS_URI });

function obtenerClavePublica(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// ---------------------------------------------------------
// Middleware de autenticación
// ---------------------------------------------------------
function autenticar(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, obtenerClavePublica, {
    algorithms: ['RS256'],
    issuer: `${KEYCLOAK_URL}/realms/${REALM}`
  }, (err, decoded) => {
    if (err) {
      console.error(`[GATEWAY] Token inválido: ${err.message} | ${JSON.stringify(err)}`);
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
    console.log(`[GATEWAY] Usuario autenticado: ${decoded.preferred_username}`);
    req.usuario = decoded;
    next();
  });
}

// ---------------------------------------------------------
// App Express
// ---------------------------------------------------------
const app = express();
app.use(cors());

// Status público (sin autenticación)
app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    keycloak: KEYCLOAK_URL,
    realm: REALM,
    timestamp: new Date().toISOString()
  });
});

// Log de peticiones
app.use((req, res, next) => {
  console.log(`[GATEWAY] ${req.method} ${req.path} → enrutando...`);
  next();
});

// ---------------------------------------------------------
// Rutas protegidas con autenticación
// ---------------------------------------------------------
app.use('/sensores', autenticar, createProxyMiddleware({
  target: 'http://localhost:8001/sensores',
  changeOrigin: true,
  proxyTimeout: 10000,
  timeout: 10000,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`[GATEWAY] → Servicio Sensores | ${req.method} ${req.originalUrl}`);
      if (req.usuario) {
        proxyReq.setHeader('X-Usuario', req.usuario.preferred_username);
      }
    },
    error: (err, req, res) => {
      console.error(`[GATEWAY] Error Servicio Sensores: ${err.message}`);
      res.status(503).json({ error: 'Servicio Sensores no disponible' });
    }
  }
}));

app.use('/notificaciones', autenticar, createProxyMiddleware({
  target: 'http://localhost:8002/notificaciones',
  changeOrigin: true,
  proxyTimeout: 10000,
  timeout: 10000,
  on: {
    proxyReq: (proxyReq, req) => {
      console.log(`[GATEWAY] → Servicio Notificaciones | ${req.method} ${req.originalUrl}`);
    },
    error: (err, req, res) => {
      console.error(`[GATEWAY] Error Servicio Notificaciones: ${err.message}`);
      res.status(503).json({ error: 'Servicio Notificaciones no disponible' });
    }
  }
}));

app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.path} no encontrada en el Gateway` });
});

app.listen(HTTP_PORT, () => {
  console.log(`[GATEWAY] API Gateway corriendo en http://localhost:${HTTP_PORT}`);
  console.log(`[GATEWAY] Keycloak: ${KEYCLOAK_URL}/realms/${REALM}`);
  console.log(`[GATEWAY] Rutas protegidas:`);
  console.log(`           /sensores/*       → http://localhost:8001`);
  console.log(`           /notificaciones/* → http://localhost:8002`);
});