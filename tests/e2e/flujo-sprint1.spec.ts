// Prueba de punta a punta del Sprint 1 (RF01, RF02 y RF03) en el navegador.
// Además guarda capturas en docs/capturas para el informe.
import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const id = randomUUID().slice(0, 6);
const DUENO = { nombre: 'Rosa Quispe', email: `rosa_${id}@prueba.pe`, password: 'Bodega_Rosa_2026' };
const AYUDANTE = { nombre: 'Luis Huamán', email: `luis_${id}@prueba.pe`, password: 'Ayudante_2026' };
const BODEGA = `Bodega Doña Rosa ${id}`;

function enDias(n: number): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  const [y, m, d] = hoy.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const aviso = (page: Page) => page.locator('[role=alert]:not(#__next-route-announcer__)');
const captura = (page: Page, nombre: string) => page.screenshot({ path: `docs/capturas/${nombre}.png` });

async function ingresar(page: Page, email: string, password: string, esperarPanel = true) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  if (esperarPanel) await expect(page).toHaveURL(/\/app$/);
}

async function salir(page: Page) {
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

test.describe.serial('Sprint 1 · flujo completo', () => {
  test('CP05 Una página interna sin sesión redirige al inicio de sesión', async ({ page }) => {
    await page.goto('/app/vender');
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fvender/);
    await captura(page, '01-inicio-sesion');
  });

  test('CP01 Registro de bodega y dueño', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Nombre de la bodega').fill(BODEGA);
    await page.getByLabel('Dirección').fill('Av. Los Próceres 123, San Juan de Lurigancho');
    await page.getByLabel('Tu nombre').fill(DUENO.nombre);
    await page.getByLabel('Correo').fill(DUENO.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(DUENO.password);
    await page.getByLabel('Repite la contraseña').fill(DUENO.password);
    await captura(page, '02-registro');
    await page.getByRole('button', { name: 'Crear mi bodega' }).click();

    await expect(page).toHaveURL(/\/app\?bienvenida=1/);
    await expect(page.getByTestId('bodega-nombre')).toHaveText(BODEGA);
    await expect(page.getByTestId('usuario-rol')).toHaveText('Dueño');
    await captura(page, '03-panel-dueno');
  });

  test('CP02 Registro con correo duplicado', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Nombre de la bodega').fill('Otra bodega');
    await page.getByLabel('Dirección').fill('Calle 1');
    await page.getByLabel('Tu nombre').fill('Otra persona');
    await page.getByLabel('Correo').fill(DUENO.email);
    await page.getByLabel('Contraseña', { exact: true }).fill('OtraClave_123');
    await page.getByLabel('Repite la contraseña').fill('OtraClave_123');
    await page.getByRole('button', { name: 'Crear mi bodega' }).click();
    await expect(aviso(page)).toHaveText('El correo ya está registrado');
    // Los datos escritos no se pierden
    await expect(page.getByLabel('Nombre de la bodega')).toHaveValue('Otra bodega');
  });

  test('CP04 Inicio de sesión con credenciales inválidas', async ({ page }) => {
    await ingresar(page, DUENO.email, 'clave_equivocada', false);
    await expect(aviso(page)).toHaveText('Correo o contraseña incorrectos');
    await captura(page, '04-login-invalido');
  });

  test('CP03, CP09, CP10 Inicio de sesión y catálogo de productos', async ({ page }) => {
    await ingresar(page, DUENO.email, DUENO.password);
    await expect(page).toHaveURL(/\/app$/);

    const productos = [
      { nombre: 'Inca Kola 500 ml', categoria: 'Bebidas', unidad: 'botella', precio: '3.50' },
      { nombre: 'Galletas Soda Field', categoria: 'Snacks y golosinas', unidad: 'paquete', precio: '1,20' },
      { nombre: 'Yogurt Gloria fresa 1 L', categoria: 'Lácteos', unidad: 'botella', precio: '6.90' },
      { nombre: 'Arroz Costeño a granel', categoria: 'Abarrotes', unidad: 'kg', precio: '4.20' },
    ];
    for (const p of productos) {
      await page.goto('/app/productos/nuevo');
      await page.getByLabel('Nombre del producto').fill(p.nombre);
      await page.getByLabel('Categoría').selectOption({ label: p.categoria });
      await page.getByLabel('Se vende por').selectOption(p.unidad);
      await page.getByLabel('Precio de venta (S/)').fill(p.precio);
      await page.getByRole('button', { name: 'Guardar producto' }).click();
      await expect(page.getByText('Producto registrado.')).toBeVisible();
    }
    await expect(page.getByTestId('lista-productos').getByRole('listitem')).toHaveCount(4);
    await captura(page, '05-productos');

    // CP10: nombre duplicado y precio inválido
    await page.goto('/app/productos/nuevo');
    await page.getByLabel('Nombre del producto').fill('inca kola 500 ML');
    await page.getByLabel('Categoría').selectOption({ label: 'Bebidas' });
    await page.getByLabel('Precio de venta (S/)').fill('0');
    await page.getByRole('button', { name: 'Guardar producto' }).click();
    await expect(page.getByText('El precio debe ser mayor a cero.')).toBeVisible();
    await page.getByLabel('Precio de venta (S/)').fill('3.50');
    await page.getByRole('button', { name: 'Guardar producto' }).click();
    await expect(aviso(page)).toHaveText('Ya existe un producto con ese nombre en tu bodega.');
    await captura(page, '06-producto-duplicado');
  });

  test('CP11, CP12 Ingreso de mercadería por lotes', async ({ page }) => {
    await ingresar(page, DUENO.email, DUENO.password);
    await page.goto('/app/mercaderia');

    const lotes = [
      { producto: 'Inca Kola 500 ml', unidad: 'botella', cantidad: '24', costo: '2.10', vence: 60 },
      { producto: 'Inca Kola 500 ml', unidad: 'botella', cantidad: '6', costo: '2.00', vence: 4 },
      { producto: 'Galletas Soda Field', unidad: 'paquete', cantidad: '30', costo: '0.80', vence: 90 },
      { producto: 'Yogurt Gloria fresa 1 L', unidad: 'botella', cantidad: '6', costo: '5.40', vence: 3 },
      { producto: 'Arroz Costeño a granel', unidad: 'kg', cantidad: '25,5', costo: '3.30', vence: 200 },
    ];
    for (const [i, l] of lotes.entries()) {
      await page.getByLabel('Producto').selectOption({ label: `${l.producto} (por ${l.unidad})` });
      await page.getByLabel(/^Cantidad/).fill(l.cantidad);
      await page.getByLabel('Costo por unidad (S/)').fill(l.costo);
      await page.getByLabel('Fecha de vencimiento').fill(enDias(l.vence));
      await page.getByRole('button', { name: 'Agregar al inventario' }).click();
      await expect(page.getByTestId('ultimos-lotes').getByRole('listitem')).toHaveCount(i + 1);
      await expect(page.getByRole('status')).toContainText(`de "${l.producto}" al inventario`);
    }

    // CP12: fecha anterior a hoy
    await page.getByLabel('Producto').selectOption({ index: 1 });
    await page.getByLabel(/^Cantidad/).fill('5');
    await page.getByLabel('Costo por unidad (S/)').fill('1');
    await page.getByLabel('Fecha de vencimiento').fill(enDias(-1));
    await page.getByRole('button', { name: 'Agregar al inventario' }).click();
    await expect(page.getByText('La fecha de vencimiento no puede ser anterior a hoy.')).toBeVisible();
    await expect(page.getByTestId('ultimos-lotes').getByRole('listitem')).toHaveCount(5);
    await captura(page, '07-mercaderia');
  });

  test('CP13 Consulta de stock con detalle de lotes', async ({ page }) => {
    await ingresar(page, DUENO.email, DUENO.password);
    await page.goto('/app/stock');
    const inca = page.getByRole('listitem').filter({ hasText: 'Inca Kola 500 ml' });
    await expect(inca.getByTestId('stock-total')).toHaveText('30');
    await inca.getByRole('button').click();
    const filas = inca.getByTestId('tabla-lotes').locator('tbody tr');
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toContainText('6');   // vence en 4 días: primero
    await expect(filas.nth(0)).toContainText('en 4 días');
    await expect(filas.nth(1)).toContainText('24');
    await captura(page, '08-stock-lotes');
  });

  test('CP14, CP15 Venta con descuento FEFO', async ({ page }) => {
    await ingresar(page, DUENO.email, DUENO.password);
    await page.goto('/app/vender');
    const agregar = (n: string) => page.getByRole('button', { name: `Agregar ${n}`, exact: true }).click();
    await agregar('Inca Kola 500 ml');
    await agregar('Inca Kola 500 ml');
    await agregar('Galletas Soda Field');
    await agregar('Arroz Costeño a granel');
    await page.getByLabel('Cantidad de Arroz Costeño a granel').fill('1,5');
    await page.getByLabel('Método de pago').selectOption('yape');
    // 2 × 3,50 + 1 × 1,20 + 1,5 × 4,20 = 14,50
    await expect(page.getByTestId('venta-total')).toHaveText(/14\.50/);
    await captura(page, '09-venta-carrito');
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByTestId('venta-ok')).toContainText('Total S/');
    await expect(page.getByTestId('venta-ok')).toContainText('14.50');
    await captura(page, '10-venta-registrada');

    // FEFO: las 2 Inca Kola salieron del lote que vence en 4 días (6 → 4); el de 60 días sigue en 24
    await page.goto('/app/stock');
    const inca = page.getByRole('listitem').filter({ hasText: 'Inca Kola 500 ml' });
    await expect(inca.getByTestId('stock-total')).toHaveText('28');
    await inca.getByRole('button').click();
    const filas = inca.getByTestId('tabla-lotes').locator('tbody tr');
    await expect(filas.nth(0)).toContainText('4 de 6');
    await expect(filas.nth(1)).toContainText('24 de 24');
    const arroz = page.getByRole('listitem').filter({ hasText: 'Arroz Costeño a granel' });
    await expect(arroz.getByTestId('stock-total')).toHaveText('24');
  });

  test('CP16 La interfaz no deja vender más que el stock', async ({ page }) => {
    await ingresar(page, DUENO.email, DUENO.password);
    await page.goto('/app/vender');
    await page.getByRole('button', { name: 'Agregar Yogurt Gloria fresa 1 L', exact: true }).click();
    await page.getByLabel('Cantidad de Yogurt Gloria fresa 1 L').fill('9');
    await expect(page.getByText('Solo hay 6 disponibles.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeDisabled();
    await captura(page, '11-venta-stock-insuficiente');
  });

  test('CP06 Registro de ayudante por el dueño', async ({ page }) => {
    await ingresar(page, DUENO.email, DUENO.password);
    await page.goto('/app/equipo');
    await page.getByLabel('Nombre').fill(AYUDANTE.nombre);
    await page.getByLabel('Correo').fill(AYUDANTE.email);
    await page.getByLabel('Contraseña temporal').fill(AYUDANTE.password);
    await page.getByRole('button', { name: 'Crear cuenta de ayudante' }).click();
    await expect(page.getByRole('status')).toContainText(`${AYUDANTE.nombre} ya puede ingresar`);
    await expect(page.getByTestId('lista-equipo')).toContainText('Ayudante');
    await captura(page, '12-equipo');
    await salir(page);
  });

  test('CP07 Restricciones del rol ayudante', async ({ page }) => {
    await ingresar(page, AYUDANTE.email, AYUDANTE.password);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId('usuario-rol')).toHaveText('Ayudante');
    await expect(page.getByTestId('bodega-nombre')).toHaveText(BODEGA);

    const menu = page.getByRole('navigation', { name: 'Menú principal' }).first();
    await expect(menu.getByRole('link', { name: 'Vender' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Stock' })).toBeVisible();
    for (const oculto of ['Productos', 'Mercadería', 'Equipo']) await expect(menu.getByRole('link', { name: oculto })).toHaveCount(0);
    await captura(page, '13-panel-ayudante');

    // Escribir la dirección a mano tampoco abre las pantallas del dueño
    for (const ruta of ['/app/productos', '/app/productos/nuevo', '/app/mercaderia', '/app/equipo']) {
      await page.goto(ruta);
      await expect(page).toHaveURL(/\/app\?restringido=1/);
    }
    await expect(page.getByText('Esa opción solo está disponible para el dueño de la bodega.')).toBeVisible();

    // Sí puede vender
    await page.goto('/app/vender');
    await page.getByRole('button', { name: 'Agregar Galletas Soda Field', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar venta' }).click();
    await expect(page.getByTestId('venta-ok')).toBeVisible();
    await salir(page);
  });

  test('Vista móvil de la venta', async ({ browser }) => {
    const ctx = await browser.newContext({ ...{ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, locale: 'es-PE' });
    const page = await ctx.newPage();
    await ingresar(page, DUENO.email, DUENO.password);
    await expect(page).toHaveURL(/\/app$/);
    await page.screenshot({ path: 'docs/capturas/14-movil-inicio.png' });
    await page.getByRole('navigation', { name: 'Menú principal' }).last().getByRole('link', { name: 'Vender' }).click();
    await page.getByRole('button', { name: 'Agregar Inca Kola 500 ml', exact: true }).click();
    await page.getByRole('button', { name: 'Agregar Galletas Soda Field', exact: true }).click();
    await page.screenshot({ path: 'docs/capturas/15-movil-venta.png' });
    await page.getByRole('link', { name: /Ver venta/ }).click();
    await expect(page.getByRole('button', { name: 'Confirmar venta' })).toBeInViewport();
    await page.screenshot({ path: 'docs/capturas/16-movil-carrito.png' });
    await ctx.close();
  });
});
