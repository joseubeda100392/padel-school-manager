import { PageSkeleton } from './page-skeleton'

// Se mantiene el nombre para las pantallas de carga existentes: ahora muestran
// un esqueleto con la forma de la página en vez de un spinner a pantalla completa.
export function Spinner() {
  return <PageSkeleton />
}
