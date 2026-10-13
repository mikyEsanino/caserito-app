# Registro de pruebas · Sprint 1

Casos de prueba (CP) de la matriz de trazabilidad del informe, con la prueba automática que los verifica.

- **API**: Vitest contra Supabase (Auth + PostgREST + PostgreSQL). Prueba las reglas en la base de datos: RLS, triggers y la función de venta.
- **E2E**: Playwright en Chromium, con el flujo real del usuario en la interfaz. Guarda capturas en `docs/capturas/`.

Ejecución del 12/10/2026: **38/38 pruebas unitarias y de API aprobadas** y **12/12 pruebas e2e aprobadas**.

| CP | Historia | Caso de prueba | Prueba de API (`tests/api`) | Prueba e2e (`tests/e2e`) | Resultado |
|---|---|---|---|---|---|
| CHK-01 | HT01 | Checklist de configuración del entorno | — | — | Ver checklist abajo |
| CP01 | HU01 | Registro exitoso de bodega y dueño | `rf01-acceso` · CP01 | CP01 | Aprobado |
| CP02 | HU01 | Registro con correo duplicado | `rf01-acceso` · CP02 | CP02 | Aprobado |
| CP03 | HU02 | Inicio de sesión válido | `rf01-acceso` · CP03 | CP03 | Aprobado |
| CP04 | HU02 | Inicio de sesión con credenciales inválidas | `rf01-acceso` · CP04 | CP04 | Aprobado |
| CP05 | HU02 | Acceso a página interna sin sesión | `rf01-acceso` · CP05 | CP05 | Aprobado |
| CP06 | HU03 | Registro de ayudante por el dueño | `rf01-acceso` · CP06 | CP06 | Aprobado |
| CP07 | HU03 | Restricciones del rol ayudante | `rf01-acceso` · CP07 | CP07 | Aprobado |
| CP08 | HU03 | Aislamiento de datos entre bodegas | `rf01-acceso` · CP08 | — | Aprobado |
| CP09 | HU04 | Registro de producto válido | `rf02-inventario` · CP09 | CP09 | Aprobado |
| CP10 | HU04 | Producto duplicado o con precio inválido | `rf02-inventario` · CP10 | CP10 | Aprobado |
| CP11 | HU05 | Registro de lote válido | `rf02-inventario` · CP11 | CP11 | Aprobado |
| CP12 | HU05 | Registro de lote con fecha vencida | `rf02-inventario` · CP12 | CP12 | Aprobado |
| CP13 | HU06 | Consulta de stock con detalle de lotes | `rf02-inventario` · CP13 | CP13 | Aprobado |
| CP14 | HU07 | Venta con stock suficiente | `rf03-ventas` · CP14 | CP14 | Aprobado |
| CP15 | HU07 | Descuento de stock por criterio FEFO | `rf03-ventas` · CP15 | CP15 | Aprobado |
| CP16 | HU07 | Venta con stock insuficiente | `rf03-ventas` · CP16 | CP16 | Aprobado |
| CP17 | HU07 | Atomicidad de la venta ante un error | `rf03-ventas` · CP17 y CP17b | — | Aprobado |

Además, `tests/unit/validaciones.test.ts` tiene 20 pruebas unitarias de las reglas de los formularios (contraseña, precios, fechas en hora de Lima, cantidades enteras, mensajes de error).

## Verificación de que las pruebas detectan errores

Para comprobar que las pruebas no pasan "por defecto", se introdujeron dos defectos a propósito y luego se revirtieron:

| Defecto introducido | Prueba que lo detectó |
|---|---|
| La venta descuenta del lote que vence **último** (FEFO invertido) | CP15 falló |
| La política RLS deja que el ayudante lea la tabla de lotes (con costos) | CP07 falló |

## Defectos encontrados durante el sprint

| ID | Descripción | Detectado por | Estado |
|---|---|---|---|
| BUG-01 | En "Nuevo producto", si había un error de validación (por ejemplo, precio 0), la categoría elegida se borraba al volver a mostrar el formulario (comportamiento de React 19 con `<select>`). | e2e CP10 | Corregido: el formulario se vuelve a montar con los valores escritos (productos, mercadería y equipo). |

## Checklist CHK-01 (HT01)

- [ ] Repositorio en GitHub con ramas `main` y `develop`.
- [ ] Reglas de protección: Pull Request con 1 aprobación y CI en verde para `main` y `develop`.
- [ ] Workflow de CI ejecutándose en GitHub Actions.
- [ ] Proyecto de Supabase con la migración aplicada.
- [ ] Despliegue en Vercel: `main` en producción y *previews* en cada Pull Request.
- [ ] Tablero Scrum en Jira con el Product Backlog y el Sprint 1.
