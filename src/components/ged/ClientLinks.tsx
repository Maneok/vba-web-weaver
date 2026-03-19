import { useNavigate } from 'react-router-dom';
import { ClipboardList, Search, User } from 'lucide-react';

interface ClientLinksProps {
  siren: string;
  clientRef: string;
}

export default function ClientLinks({ siren, clientRef }: ClientLinksProps) {
  const navigate = useNavigate();

  const links = [
    {
      icon: ClipboardList,
      label: 'Lettres de mission',
      onClick: () => navigate(`/lettres-mission?client=${clientRef}`),
    },
    {
      icon: Search,
      label: 'Fiche LCB-FT',
      onClick: () => navigate(`/registre?siren=${siren}`),
    },
    {
      icon: User,
      label: 'Fiche client',
      onClick: () => navigate(`/clients/${clientRef}`),
    },
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {links.map(link => (
        <button
          key={link.label}
          onClick={link.onClick}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline transition-colors"
        >
          <link.icon className="h-3.5 w-3.5" />
          {link.label}
        </button>
      ))}
    </div>
  );
}
