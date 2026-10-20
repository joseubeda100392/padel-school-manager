import { notFound } from 'next/navigation'
import { MasMock } from './mas-mock'

// Maqueta de la navegación del alumno: 4 pestañas + "Más" (solo desarrollo).
export default function MasPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <MasMock />
}
