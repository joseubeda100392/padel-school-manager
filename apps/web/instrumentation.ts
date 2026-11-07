// Se ejecuta una vez al arrancar el servidor. Todo lo de Node va en
// instrumentation-node.ts y se importa solo dentro de este if: Next sustituye
// NEXT_RUNTIME al compilar y así no lo mete en la versión «edge», donde no
// existen módulos de Node como crypto (si se cuela, la app entera da error 500).
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node')
    await registerNode()
  }
}
