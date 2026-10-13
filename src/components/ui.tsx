import type { ReactNode } from 'react';

export function Campo({
  nombre,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  nombre: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={nombre} className="etiqueta">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error && <p className="mt-1 text-sm text-suave">{ayuda}</p>}
      {error && (
        <p id={`${nombre}-error`} className="mt-1 text-sm font-medium text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'bien' | 'alerta' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'border-error/30 bg-error-claro text-error',
    bien: 'border-bien/30 bg-bien-claro text-bien',
    alerta: 'border-alerta/30 bg-alerta-clara text-alerta',
    info: 'border-linea bg-papel text-tinta',
  }[tipo];
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-[0.95rem] font-medium ${estilos}`}>
      {children}
    </div>
  );
}

export function Encabezado({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 text-suave">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}

export function Insignia({ tono, children }: { tono: 'bien' | 'alerta' | 'error' | 'neutro' | 'marca'; children: ReactNode }) {
  const estilos = {
    bien: 'bg-bien-claro text-bien',
    alerta: 'bg-alerta-clara text-alerta',
    error: 'bg-error-claro text-error',
    neutro: 'bg-papel text-suave border border-linea',
    marca: 'bg-marca-clara text-marca-oscura',
  }[tono];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${estilos}`}>{children}</span>;
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true" className="h-7 w-7 shrink-0">
        <rect width="32" height="32" rx="8" fill="#b3431b" />
        <path d="M6 14 L9 8 H23 L26 14 Z" fill="#fbe9df" />
        <rect x="8" y="14" width="16" height="11" rx="1.5" fill="#fff" />
        <rect x="14" y="18" width="4" height="7" fill="#b3431b" />
      </svg>
      Caserito
    </span>
  );
}
