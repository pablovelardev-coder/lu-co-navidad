# Lu & Co. Navidad

App de Luciana para diseñar esferas navideñas personalizadas, pedirlas e imprimirlas en casa
(impresora AOSEED X-MAKER JOY AI, PLA de 1.75 mm, esferas de 5.5 cm, 4 por tanda).

Página estática (sin compilar) pensada para GitHub Pages. Datos en Supabase, en un proyecto
**separado del tablero**.

## Pantallas
- `#inicio`: catálogo y precios por tanda
- `#disenar/<forma>`: forma, color, nombre (letra elegante o redondita) y adorno, con vista 3D real
- `#pedido`: carrito, aviso para completar la tanda de 4, datos del adulto y forma de pago
- `#seguimiento/<código>`: en qué paso va el pedido y cómo pagar
- `#panel`: resumen (vendido por semana y mes, entregas, merma, funnel), pedidos, tandas y filamento

## Cómo imprime
El panel arma cada tanda (hasta 4 esferas del mismo color, en cuadro de 2 × 2, 114 × 112 mm) y la
descarga como STL. Se abre en la app X-MAKER con "Importar archivo".

Medidas de la pieza: base de 3 mm, nombre en relieve de 1.2 mm, adornos de 0.8 mm, hoyo de 3.5 mm.

## Modo prueba
Con `supabaseUrl` vacío en `js/config.js`, todo se guarda en el aparato. PIN del panel: `demoPin`.

## Conectar Supabase
1. Crear un proyecto nuevo (no usar el del tablero).
2. Correr `supabase/schema.sql`.
3. Crear las cuentas del panel en Authentication y agregar sus correos a `public.admins`.
4. Poner la URL y la llave pública (anon) en `js/config.js`.

## Probar en la Mac
```
python3 -m http.server 8642 --directory ~/Developer/lu-co-navidad
```
