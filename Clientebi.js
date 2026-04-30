/**
 * CLIENTE BI / ESTADISTICA
 * 
 * Simula un sistema externo de inteligencia de negocios o estadistica
 * que recupera datos periodicamente via HTTP REST para analisis
 * o modelos predictivos.
 * 
 * Comunicacion: HTTP REST (GET) → cada 5 segundos
 */

const http = require('http');

const SERVER_HOST   = 'localhost';
const SERVER_PORT   = 3000;
const INTERVALO_MS  = 5000; // consulta cada 5 segundos

function consultarAPI(endpoint) {
  return new Promise((resolve, reject) => {
    const opciones = {
      hostname: SERVER_HOST,
      port:     SERVER_PORT,
      path:     endpoint,
      method:   'GET'
    };

    const req = http.request(opciones, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('Respuesta no valida'));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function cicloConsulta() {
  console.log(`\n[BI] ──── Consulta periodica ${new Date().toLocaleTimeString()} ────`);

  try {
    // 1. Obtener estado general
    const status = await consultarAPI('/status');
    console.log(`[BI] Estado servidor → Mediciones totales: ${status.totalMediciones} | Suscriptores alarma: ${status.suscriptoresAlarma}`);

    // 2. Obtener lista de sensores activos
    const sensores = await consultarAPI('/sensores');
    console.log(`[BI] Sensores activos: ${sensores.total}`);

    // 3. Obtener ultimas mediciones
    const ultimas = await consultarAPI('/mediciones/ultima');
    ultimas.sensores.forEach(m => {
      console.log(`[BI] Sensor ${m.sensorId} → Temp: ${m.temperatura}°C | Humedad: ${m.humedad}% | ${m.timestamp}`);
    });

    // 4. Simular calculo estadistico simple
    const mediciones = await consultarAPI('/mediciones');
    if (mediciones.total > 0) {
      const temps    = mediciones.mediciones.map(m => m.temperatura);
      const humedades = mediciones.mediciones.map(m => m.humedad);
      const promTemp  = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
      const promHum   = (humedades.reduce((a, b) => a + b, 0) / humedades.length).toFixed(1);
      console.log(`[BI] Estadisticas → Temp promedio: ${promTemp}°C | Humedad promedio: ${promHum}%`);
    }

  } catch (err) {
    console.error(`[BI] Error consultando API: ${err.message}. ¿Esta corriendo server.js?`);
  }
}

console.log(`[BI] Sistema de BI iniciado. Consultando API cada ${INTERVALO_MS / 1000}s...`);
cicloConsulta();
setInterval(cicloConsulta, INTERVALO_MS);