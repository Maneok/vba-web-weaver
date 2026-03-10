import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useAppState } from "@/lib/AppContext";
import type { Client } from "@/lib/types";
import { ChevronsUpDown, Check, UserPlus, Building2 } from "lucide-react";
import { toast } from "sonner";

interface ClientSelectorProps {
  selectedRef: string | null;
  onClientSelected: (client: Client) => void;
}

export default function ClientSelector({ selectedRef, onClientSelected }: ClientSelectorProps) {
  const { clients } = useAppState();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.ref === selectedRef) ?? null,
    [clients, selectedRef]
  );

  const handleSelect = (ref: string) => {
    const client = clients.find((c) => c.ref === ref);
    if (!client) return;
    onClientSelected(client);
    setOpen(false);
    toast.success(`Donnees de ${client.raisonSociale} chargees`);
  };

  return (
    <div className="flex items-center gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Selectionner un client"
            className="w-[480px] justify-between h-11 bg-card/80 backdrop-blur border-white/10 hover:border-blue-500/50 transition-colors"
          >
            {selectedClient ? (
              <div className="flex items-center gap-2 truncate">
                <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="font-mono text-xs text-muted-foreground">{selectedClient.ref}</span>
                <span className="mx-1 text-muted-foreground">—</span>
                <span className="font-medium truncate">{selectedClient.raisonSociale}</span>
                <span className="mx-1 text-muted-foreground">—</span>
                <span className="font-mono text-xs text-muted-foreground">{selectedClient.siren}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Selectionner un client...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[480px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher par nom, ref ou SIREN..." aria-label="Rechercher un client" />
            <CommandList>
              <CommandEmpty>Aucun client trouve.</CommandEmpty>
              <CommandGroup heading={`${clients.length} client(s)`}>
                {clients.map((client) => (
                  <CommandItem
                    key={client.ref}
                    value={`${client.ref} ${client.raisonSociale} ${client.siren}`}
                    onSelect={() => handleSelect(client.ref)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Check
                      className={`h-4 w-4 shrink-0 ${
                        selectedRef === client.ref ? "opacity-100 text-blue-400" : "opacity-0"
                      }`}
                    />
                    <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{client.ref}</span>
                    <span className="mx-1 text-muted-foreground">—</span>
                    <span className="truncate flex-1 font-medium">{client.raisonSociale}</span>
                    <span className="mx-1 text-muted-foreground">—</span>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">{client.siren}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        aria-label="Creer un nouveau client"
        className="gap-2 shrink-0 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
        onClick={() => navigate("/nouveau-client")}
      >
        <UserPlus className="h-4 w-4" />
        Nouveau client
      </Button>
    </div>
  );
}
