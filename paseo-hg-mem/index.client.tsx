import type { PluginClientContext, PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { MemoryPanel } from "./client/memory-panel";
import { MemorySetup } from "./client/memory-setup";
import { requestMemorySearch } from "./client/intent";
import { memoryAttachmentSource } from "./shared/contracts";

export default function contribute(client: PluginClientContext) {
  const openSetup = () => client.openSettings("setup");

  function MemoryWorkspacePanel(props: PluginWorkspacePanelProps) {
    return <MemoryPanel {...props} onOpenSetup={openSetup} />;
  }

  const removers = [
    client.addSettingsScreen({ id: "setup", title: "Memory setup", icon: "Settings", Component: MemorySetup }),
    client.addWorkspacePanel({
      id: "memory",
      title: "Memory",
      icon: "Brain",
      context: "workspace",
      Component: MemoryWorkspacePanel,
    }),
    client.addSlashCommand({
      name: "memory",
      description: "Open this workspace's memory",
      argumentHint: "[search]",
      context: "workspace",
      onSubmit({ args, workspace, openPanel }) {
        requestMemorySearch(workspace.id, args);
        openPanel("memory");
      },
    }),
    client.addCommandCenterItem({
      id: "open-memory",
      title: "Open memory",
      icon: "Brain",
      keywords: ["memory", "instructions"],
      context: "workspace",
      onSelect({ openPanel }) {
        openPanel("memory");
      },
    }),
    client.addAttachmentSource(memoryAttachmentSource),
  ];

  return async () => {
    for (const remove of removers) await remove();
  };
}
