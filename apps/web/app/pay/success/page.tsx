export default function PaySuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="mb-4 text-6xl">✅</div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">¡Pago completado!</h1>
      <p className="mb-8 text-gray-500">Tu pago se ha procesado correctamente. Ya puedes volver a la app.</p>
      <p className="text-sm text-gray-400">Puedes cerrar esta ventana.</p>
    </div>
  )
}
