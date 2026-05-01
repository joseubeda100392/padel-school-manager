import { Redirect } from 'expo-router'

// Redirige a la pantalla de autenticación al arrancar
export default function Index() {
  return <Redirect href="/(auth)/login" />
}
