<template>
  <div class="dashboard">
    <nav>
      <div class="brand">🌱 Invernadero</div>
      <div class="links">
        <router-link to="/dashboard">Dashboard</router-link>
        <router-link to="/sensores">Sensores</router-link>
        <router-link to="/suscripciones">Notificaciones</router-link>
        <button @click="logout">Cerrar sesión</button>
      </div>
    </nav>

    <div class="content">
      <h2>Dashboard en tiempo real</h2>
      <p class="subtitle">Monitoreo del invernadero — actualización automática cada 10s</p>

      <div class="grafana-container">
        <iframe
          src="http://localhost:3000/d/ae2f8aa3-f61c-4181-8cd5-e1da0687fa13/dashboard-invernadero?orgId=1&refresh=10s&theme=dark"
          width="140%"
          height="1400"
          frameborder="0"
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DashboardView',
  methods: {
    logout() {
      localStorage.removeItem('token')
      this.$router.push('/login')
    }
  }
}
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background: #0f0f1a;
  color: white;
}

nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.brand {
  font-size: 20px;
  font-weight: bold;
  color: #4caf50;
}

.links {
  display: flex;
  align-items: center;
  gap: 24px;
}

.links a {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s;
}

.links a:hover, .links a.router-link-active {
  color: #4caf50;
}

.links button {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.2);
  background: transparent;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.links button:hover {
  background: rgba(255,255,255,0.1);
  color: white;
}

.content {
  padding: 32px;
}

h2 {
  margin: 0 0 4px;
  font-size: 24px;
}

.subtitle {
  color: rgba(255,255,255,0.5);
  font-size: 14px;
  margin-bottom: 24px;
}

.grafana-container {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.1);
}
</style>