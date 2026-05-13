/**
 * LOAD BALANCER
 * 
 * Responsabilidades:
 * 1. Recibir peticiones del Frontend
 * 2. Distribuirlas entre instancias del API Gateway usando Round Robin
 * 3. Detectar instancias caídas y redirigir el tráfico
 * 
 * En producción habría múltiples instancias del API Gateway.
 * Para la PoC se simula con una sola instancia real y una simulada.
 */

const express = require('express');
const cors    = require('cors');
const http    = require('http');

const HTTP_PORT = 8080;

// Instancias del API Gateway disponibles
const instancias = [
  { host: 'localhost', port: 9000, activa: true },
  { host: 'localhost', port: 9001, activa: true } // simulada (para demostrar el balanceo)
];

let indiceActual = 0;

// ---------------------------------------------------------
// Round Robin - selecciona la siguiente instancia activa
// ---------------------------------------------------------
function seleccionarInstancia() {
  const activas = instancias.filter(i => i.activa);
  if (activas.length === 0) return null;

  const instancia = activas[indiceActual % activas.length];
  indiceActual++;
  return instancia;
}

// ---------------------------------------------------------
// Verificar si una instancia está disponible
// ---------------------------------------------------------
function verificarInstancia(instancia) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://${instancia.host}:${instancia.port}/status`,
      (res) => {
        instancia.activa = res.statusCode === 200;
        res.resume();
        resolve();
      }
    );
    req.setTimeout(2000, () => {
      instancia.activa = false;
      req.destroy();
      resolve();
    });
    req.on('error', () => {
      instancia.activa = false;
      resolve();
    });
  });
}

// Verificar instancias cada 5 segundos
async function verificarInstancias() {
  await Promise.all(instancias.map(verificarInstancia));
  const estado = instancias.map(i => `${i.host}:${i.port} → ${i.activa ? 'activa' : 'inactiva'}`);
  console.log(`[BALANCER] Estado: ${estado.join(' | ')}`);
}
setInterval(verificarInstancias, 5000);

// ---------------------------------------------------------
// Proxy manual hacia la instancia seleccionada
// ---------------------------------------------------------
function reenviarPeticion(req, res, instancia) {
  const opciones = {
    hostname: instancia.host,
    port:     instancia.port,
    path:     req.url,
    method:   req.method,
    headers:  { ...req.headers, host: `${instancia.host}:${instancia.port}` }
  };

  const proxy = http.request(opciones, (respuesta) => {
    res.writeHead(respuesta.statusCode, respuesta.headers);
    respuesta.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error(`[BALANCER] Error con instancia ${instancia.host}:${instancia.port}: ${err.message}`);
    instancia.activa = false;

    // Intentar con otra instancia
    const siguiente = seleccionarInstancia();
    if (siguiente && siguiente !== instancia) {
      console.log(`[BALANCER] Reintentando con ${siguiente.host}:${siguiente.port}`);
      reenviarPeticion(req, res, siguiente);
    } else {
      res.status(503).json({ error: 'No hay instancias del API Gateway disponibles' });
    }
  });

  req.pipe(proxy);
}

// ---------------------------------------------------------
// Servidor del Load Balancer
// ---------------------------------------------------------
const app = express();
app.use(cors());

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    algoritmo: 'Round Robin',
    instancias: instancias.map(i => ({
      url: `http://${i.host}:${i.port}`,
      activa: i.activa
    })),
    timestamp: new Date().toISOString()
  });
});

// Todas las demás peticiones se balancean
app.use((req, res) => {
  const instancia = seleccionarInstancia();

  if (!instancia) {
    return res.status(503).json({ error: 'No hay instancias disponibles' });
  }

  console.log(`[BALANCER] ${req.method} ${req.url} → ${instancia.host}:${instancia.port}`);
  reenviarPeticion(req, res, instancia);
});

app.listen(HTTP_PORT, () => {
  console.log(`[BALANCER] Load Balancer corriendo en http://localhost:${HTTP_PORT}`);
  console.log(`[BALANCER] Algoritmo: Round Robin`);
  console.log(`[BALANCER] Instancias:`);
  instancias.forEach(i => console.log(`           http://${i.host}:${i.port}`));
  verificarInstancias();
});