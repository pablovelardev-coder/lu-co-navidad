// Configuración de Lu & Co. Navidad.
// Si supabaseUrl está vacío, la app corre en "modo prueba": los pedidos se guardan solo en este aparato.
export const CONFIG = {
  // Proyecto de Supabase "lu-co-navidad" (separado del tablero). La llave anon es pública por diseño:
  // la seguridad la ponen las reglas (RLS) de supabase/schema.sql.
  supabaseUrl: 'https://lebjyalluhxabzidyoxc.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlYmp5YWxsdWh4YWJ6aWR5b3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjM3NjgsImV4cCI6MjExMDA5OTc2OH0.FdjmBhR1gwTZ-2b-97qg0G87aCAdgV4R7CKDt7PKVq0',

  // Dirección pública de la app (para el QR y para compartir por mensaje)
  urlApp: 'https://pablovelardev-coder.github.io/lu-co-navidad/',
  // Mensaje para compartir (voz de Luciana, 17-nov). También va en la vista previa de la liga (index.html).
  mensajeCompartir: '¡Hola! Soy Luciana 🎄 Abrí Lu & Co. Navidad, mi primer negocio: adornos navideños con el nombre que tú quieras. Tú los diseñas y yo los imprimo en 3D en mi casa. Con esto estoy aprendiendo a emprender y ahorrando para la guitarra de LEGO de Olivia Rodrigo 🎸 Diseña el tuyo aquí:',

  // En qué paso del camino de "aprender a emprender" vamos. Se resalta en el inicio.
  // 0 diseñar · 1 hacer la app · 2 vender · 3 producir y costos · 4 inventario · 5 programa de producción · 6 cobranza
  etapa: 2,

  // Llave pública de los avisos (Web Push). La privada vive solo en Supabase (tabla push_config).
  vapidPublica: 'BLNnRphIeLY9LyNIoIX4LSsZ35IwtxxwEpWfrE8K33xzF-SS37ndMvAsnzc1Zk5gAA1Qd1fV4sipNsPAlelRmAA',

  // PIN del panel en modo prueba (con Supabase se entra con correo y contraseña)
  demoPin: '2512',

  // Datos para pagar que ve el cliente cuando Luciana acepta su pedido.
  // Papá los llena; si quedan vacíos, la app dice que se mandan por WhatsApp.
  pago: { titular: '', clabe: '', banco: '' },

  // Adornos 3D a la venta (17-nov). Precio en pricing.js: $100 por figura con la tanda llena (2).
  venta3d: true,

  // Tamaño de las esferas en milímetros (decidido: 5.5 cm, caben 4 por tanda)
  tamanoMm: 55,
};
