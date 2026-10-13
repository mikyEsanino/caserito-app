import { LoginForm } from './login-form';

export const metadata = { title: 'Iniciar sesión' };

const AVISOS: Record<string, string> = {
  confirmacion: 'El enlace de confirmación no es válido o ya venció. Intenta ingresar o regístrate de nuevo.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return <LoginForm next={next} aviso={error ? AVISOS[error] : undefined} />;
}
