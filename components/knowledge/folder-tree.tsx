"use client";

import { useMemo, useState } from "react";
import { FileTree, FileTreeFolder } from "@/components/ai-elements/file-tree";
import type { Folder } from "@/types";
import { cn } from "@/lib/utils";

interface FolderTreeProps {
  folders: Folder[];
  documentCountByFolderId: Record<string, number>;
  rootName: string;
  totalDocumentCount: number;
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
}

interface FolderNode extends Folder {
  children: FolderNode[];
}

const ROOT_PATH = "__knowledge_base_root__";

const toFolderPath = (folderId: string) => `folder:${folderId}`;
function buildFolderNodes(folders: Folder[]): FolderNode[] {
  const childrenByParent = new Map<string | null, Folder[]>();

  for (const folder of folders) {
    const siblings = childrenByParent.get(folder.parentFolderId) ?? [];
    siblings.push(folder);
    childrenByParent.set(folder.parentFolderId, siblings);
  }

  const build = (parentFolderId: string | null): FolderNode[] =>
    (childrenByParent.get(parentFolderId) ?? []).map((folder) => ({
      ...folder,
      children: build(folder.id),
    }));

  return build(null);
}

function renderFolderNodes(
  nodes: FolderNode[],
  documentCountByFolderId: Record<string, number>,
): React.ReactNode {
  return nodes.map((node) => (
    <FileTreeFolder
      key={node.id}
      name={node.name}
      path={toFolderPath(node.id)}
      hasChildren={node.children.length > 0}
    >
      {renderFolderNodes(node.children, documentCountByFolderId)}
    </FileTreeFolder>
  ));
}

export function FolderTree({
  folders,
  documentCountByFolderId,
  rootName,
  totalDocumentCount,
  selectedFolderId,
  onSelect,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([ROOT_PATH]));

  const rootNodes = useMemo(() => buildFolderNodes(folders), [folders]);

  const selectedPath = selectedFolderId
    ? toFolderPath(selectedFolderId)
    : ROOT_PATH;

  return (
    <div className="space-y-1">
      <FileTree
        className={cn(
          "border-0 bg-transparent p-0 font-sans text-sm shadow-none",
          "[&>div]:p-0"
        )}
        expanded={expanded}
        selectedPath={selectedPath}
        onExpandedChange={setExpanded}
        onSelect={(path) => {
          if (path === ROOT_PATH) {
            onSelect(null);
            return;
          }

          if (path.startsWith("folder:")) {
            onSelect(path.slice("folder:".length));
          }
        }}
      >
        <FileTreeFolder
          name={`${rootName} (${totalDocumentCount})`}
          path={ROOT_PATH}
        >
          {renderFolderNodes(rootNodes, documentCountByFolderId)}
        </FileTreeFolder>
      </FileTree>
    </div>
  );
}
