import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, LayoutTemplate, History, Settings } from "lucide-react";
import LettreMissionEditor from "@/components/lettre-mission/LettreMissionEditor";
import TemplateManager from "@/components/lettre-mission/TemplateManager";
import LettreMissionHistory from "@/components/lettre-mission/LettreMissionHistory";
import CabinetConfigForm from "@/components/lettre-mission/CabinetConfigForm";

export default function LettreMissionPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-xl font-bold">Lettre de Mission</h1>
        <p className="text-sm text-muted-foreground">
          Editeur, templates et historique des lettres de mission
        </p>
      </div>

      <Tabs defaultValue="editor" className="flex-1 flex flex-col px-6">
        <TabsList className="w-fit">
          <TabsTrigger value="editor" className="gap-2">
            <FileText className="h-4 w-4" />
            Nouvelle lettre
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <LayoutTemplate className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="editor" className="flex-1 mt-0 border rounded-lg overflow-hidden">
          <LettreMissionEditor />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplateManager />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <LettreMissionHistory />
        </TabsContent>

        <TabsContent value="config" className="mt-4 pb-6">
          <CabinetConfigForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
