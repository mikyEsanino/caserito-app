import { Logo } from '@/components/ui';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-8">
      <div className="mb-6 text-center">
        <Logo className="text-2xl text-marca" />
        <p className="mt-1 text-sm text-suave">El asistente de la bodega</p>
      </div>
      {children}
    </main>
  );
}
