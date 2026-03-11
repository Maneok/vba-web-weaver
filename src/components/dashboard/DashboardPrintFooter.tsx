import { useMemo } from "react";

interface DashboardPrintFooterProps {
  cabinetName: string;
}

export default function DashboardPrintFooter({
  cabinetName,
}: DashboardPrintFooterProps) {
  const { formattedDate, formattedTime } = useMemo(() => {
    const now = new Date();
    return {
      formattedDate: now.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }),
      formattedTime: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    };
  }, []);

  return (
    <div className="hidden print:block text-black bg-white mt-8">
      <hr className="border-gray-400 mb-3" />

      <div className="text-center space-y-1">
        <p className="text-xs font-medium tracking-wide text-gray-700">
          CONFIDENTIEL — {cabinetName}
        </p>
        <p className="text-xs text-gray-500">
          Imprimé le {formattedDate} à {formattedTime}
        </p>
        <p className="text-xs text-gray-500">
          Page générée automatiquement par GRIMY
        </p>
      </div>
    </div>
  );
}
