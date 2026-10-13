# Caserito · El asistente de la bodega

Proyecto Integrador del curso **Calidad de Software** (Universidad ESAN).
Plataforma web (PWA) para que el bodeguero controle su inventario por lotes y fechas de vencimiento y registre ventas con descuento automático de stock.

Este repositorio contiene el **incremento del Sprint 1**:

| RF | Historia | Qué hace | Dónde está |
|---|---|---|---|
| — | HT01 | Repositorio, entornos, CI y tablero | `.github/`, `supabase/config.toml` |
| RF01 | HU01 | Registro de bodega y dueño | `src/app/(auth)/registro` + trigger `registrar_dueno()` |
| RF01 | HU02 | Inicio y cierre de sesión, rutas protegidas | `src/app/(auth)/login`, `src/middleware.ts` |
| RF01 | HU03 | Cuenta de ayudante con permisos limitados | `src/app/app/equipo`, políticas RLS |
| RF02 | HU04 | Catálogo de productos | `src/app/app/productos` |
| RF02 | HU05 | Ingreso de mercadería por lotes | `src/app/app/mercaderia` + trigger `validar_lote()` |
| RF02 | HU06 | Stock con detalle de lotes | `src/app/app/stock`, vistas `v_stock` y `v_lotes` |
| RF03 | HU07 | Venta con descuento FEFO en una transacción | `src/app/app/vender` + función `registrar_venta()` |

## Tecnologías

- **Next.js 15** (App Router, Server Actions) + **React 19** + **Tailwind CSS 4**, instalable como PWA.
- **Supabase**: PostgreSQL, autenticación y Row Level Security (RLS) para separar los datos de cada bodega.
- **Vitest** (pruebas unitarias y de API) y **Playwright** (pruebas e2e en navegador).
- **GitHub Actions** (integración continua) y **Vercel** (despliegue).

## Cómo está construido

```
src/
  app/(auth)/        registro e inicio de sesión
  app/app/           panel: inicio, vender, stock, mercadería, productos, equipo
  lib/               validaciones, mensajes de error, clientes de Supabase
  middleware.ts      renueva la sesión y protege /app/*
supabase/migrations/ esquema, RLS, triggers y la función de venta
tests/unit           reglas de validación
tests/api            CP01–CP17 contra Supabase (RLS, FEFO, atomicidad)
tests/e2e            flujo completo en el navegador + capturas en docs/capturas
scripts/seed-demo.mjs datos de demo
```

**Reglas de negocio que garantiza la base de datos** (no solo la interfaz):

- Cada usuario solo ve los datos de su bodega (RLS en todas las tablas).
- El ayudante no crea productos, no cambia precios, no ingresa mercadería y no ve costos.
- Un lote no se puede registrar con fecha de vencimiento anterior a hoy (hora de Lima).
- Los productos por unidad, paquete, botella, etc. solo admiten cantidades enteras; kg y litro admiten decimales.
- La venta toma el precio de la base de datos, descuenta primero del lote que vence antes (**FEFO**), nunca vende lotes vencidos y se guarda completa o no se guarda (una sola transacción). Dos ventas simultáneas del último stock no pueden pasar las dos.

---

## Puesta en marcha (paso a paso)

### 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com>, crea una cuenta y un proyecto nuevo (plan gratuito, región *South America (São Paulo)*).
2. Abre **SQL Editor → New query**, pega todo el contenido de `supabase/migrations/20261012000000_sprint1.sql` y pulsa **Run**. Debe terminar sin errores.
3. En **Authentication → Sign In / Providers → Email**:
   - Desactiva **Confirm email** (para la demo; si lo dejas activo, el registro pedirá confirmar el correo).
   - Pon **Minimum password length** en `8`.
4. En **Authentication → URL Configuration**, pon como *Site URL* la dirección de tu app (por ejemplo `http://localhost:3000` y luego la de Vercel).
5. En **Project Settings → API Keys** copia la URL del proyecto, la clave **anon / publishable** y la clave **service_role / secret**.

> Alternativa con la CLI de Supabase: `npx supabase link --project-ref TU_REF` y luego `npx supabase db push`.

### 2. Configurar y ejecutar la app

```bash
npm install
cp .env.example .env.local      # y completa las 3 variables
npm run dev                     # http://localhost:3000
npm run seed                    # opcional: carga una bodega de demo
```

El script de demo crea:

| Rol | Correo | Contraseña |
|---|---|---|
| Dueño | `demo@caserito.pe` | `Caserito2026` |
| Ayudante | `ayudante@caserito.pe` | `Ayudante2026` |

con 15 productos, lotes que vencen en pocos días, un lote vencido y algunas ventas.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` salta todas las reglas de seguridad. Solo va en `.env.local` y en las variables de Vercel; nunca en el código ni con prefijo `NEXT_PUBLIC_`.

### 3. Desplegar en Vercel

1. Sube el repositorio a GitHub (ver punto 5).
2. En <https://vercel.com> → **Add New → Project** → importa el repositorio.
3. En **Environment Variables** agrega las 3 variables de `.env.example`.
4. **Deploy**. La rama `main` queda como producción y cada Pull Request genera un *preview* (entorno de pruebas).
5. Copia la URL de producción en Supabase → *Authentication → URL Configuration*.

### 4. Pruebas

```bash
npm run lint && npm run typecheck
npx vitest run tests/unit       # no necesita base de datos
```

Las pruebas de API y e2e necesitan un Supabase **local** (requiere Docker):

```bash
npx supabase start              # aplica la migración automáticamente
npx supabase status -o env      # copia API_URL, ANON_KEY y SERVICE_ROLE_KEY a .env.local
npm test                        # unitarias + API (CP01–CP17)
npm run build && npm run test:e2e
```

> No corras las pruebas contra el proyecto de producción: crean muchas bodegas de prueba.

El detalle de cada caso de prueba y su resultado está en [`docs/PRUEBAS.md`](docs/PRUEBAS.md).
En GitHub, el workflow `.github/workflows/ci.yml` corre todo esto en cada Pull Request.

### 5. Repositorio y GitFlow

El repositorio ya viene con la estrategia GitFlow del informe:

- `main`: producción; cada sprint cerrado lleva una etiqueta (`v0.1-Sprint1`).
- `develop`: integración.
- `feature/HUxx-…`: una rama por historia de usuario, integrada con merge a `develop`.

```bash
git remote add origin https://github.com/USUARIO/caserito.git
git push -u origin main develop
git push origin --tags
```

Después, en GitHub → **Settings → Branches**, agrega reglas de protección para `main` y `develop`:
*Require a pull request before merging* (1 aprobación) y *Require status checks to pass* (CI).
Desde el Sprint 2, cada historia se integra solo por Pull Request (la plantilla trae la checklist del DoD).
