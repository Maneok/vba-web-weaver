interface DashboardPrintHeaderProps {
  cabinetName: string;
  userName: string;
  date: string;
}

export default function DashboardPrintHeader({
  cabinetName,
  userName,
  date,
}: DashboardPrintHeaderProps) {
  return (
    <div className="hidden print:block text-black bg-white mb-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">{cabinetName}</h1>
          <p className="text-base mt-1">
            Tableau de bord — Conformité LCB-FT
          </p>
        </div>
        <p className="text-sm text-gray-600">{date}</p>
      </div>

      <p className="text-sm text-gray-600 mt-2">
        Généré par {userName}
      </p>

      <hr className="border-gray-400 mt-4 mb-2" />

      <p className="text-xs text-gray-500 text-center font-medium tracking-wide">
        CONFIDENTIEL — Usage interne uniquement
      </p>
    </div>
  );
}
