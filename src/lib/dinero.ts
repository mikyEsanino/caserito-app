import type { MetodoPago } from './validaciones';

/**
 * Redondeo a favor del consumidor en pagos en efectivo
 * (Código de Protección y Defensa del Consumidor, art. 44):
 * se baja al múltiplo de S/ 0.10 inferior. S/ 36.54 → S/ 36.50.
 * Se trabaja en céntimos enteros para evitar errores de punto flotante.
 */
export function redondeoEfectivo(total: number): number {
  const centimos = Math.round(total * 100);
  return (centimos - (centimos % 10)) / 100;
}

/** Lo que paga el cliente según el método de pago (igual que registrar_venta en la BD). */
export function totalACobrar(total: number, metodo: MetodoPago): number {
  return metodo === 'efectivo' ? redondeoEfectivo(total) : Math.round(total * 100) / 100;
}
