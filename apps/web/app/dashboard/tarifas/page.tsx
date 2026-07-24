import { TarifasClient } from './tarifas-client'

export default function DashboardTarifasPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tarifas</h1>
        <p className="text-sm text-gray-500">Configura los precios de clases y bonos para los alumnos</p>
      </div>
      <TarifasClient />
    </div>
  )
}
