// Configuración de Lu & Co. Navidad.
// Si supabaseUrl está vacío, la app corre en "modo prueba": los pedidos se guardan solo en este aparato.
export const CONFIG = {
  // Proyecto de Supabase "lu-co-navidad" (separado del tablero). La llave anon es pública por diseño:
  // la seguridad la ponen las reglas (RLS) de supabase/schema.sql.
  supabaseUrl: 'https://lebjyalluhxabzidyoxc.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlYmp5YWxsdWh4YWJ6aWR5b3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjM3NjgsImV4cCI6MjExMDA5OTc2OH0.FdjmBhR1gwTZ-2b-97qg0G87aCAdgV4R7CKDt7PKVq0',

  // PIN del panel en modo prueba (con Supabase se entra con correo y contraseña)
  demoPin: '2512',

  // Datos para pagar que ve el cliente cuando Luciana acepta su pedido.
  // Papá los llena; si quedan vacíos, la app dice que se mandan por WhatsApp.
  pago: { titular: '', clabe: '', banco: '' },

  // Tamaño de las esferas en milímetros (decidido: 5.5 cm, caben 4 por tanda)
  tamanoMm: 55,
};
