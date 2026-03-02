"use client";

import { useState } from "react";
import { Folder as FolderIcon, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Folder } from "@/types";
import { cn } from "@/lib/utils";

interface FolderTreeProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string, parentFolderId?: string) => Promise<void>;
}

interface FolderNodeProps {
  folder: Folder;
  children: Folder[];
  allFolders: Folder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  level: number;
}

function FolderNode({
  folder,
  children,
  allFolders,
  selectedFolderId,
  onSelect,
  level,
}: FolderNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-accent",
          selectedFolderId === folder.id && "bg-accent font-medium"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{folder.name}</span>
      </div>
      {expanded &&
        children.map((child) => (
          <FolderNode
            key={child.id}
            folder={child}
            children={allFolders.filter((f) => f.parentFolderId === child.id)}
            allFolders={allFolders}
            selectedFolderId={selectedFolderId}
            onSelect={onSelect}
            level={level + 1}
          />
        ))}
    </div>
  );
}

export function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
  onCreate,
}: FolderTreeProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const rootFolders = folders.filter((f) => !f.parentFolderId);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreate(newName);
    setNewName("");
    setCreating(false);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 py-1">
        <button
          className={cn(
            "text-sm font-medium cursor-pointer hover:text-foreground",
            selectedFolderId === null
              ? "text-foreground"
              : "text-muted-foreground"
          )}
          onClick={() => onSelect(null)}
        >
          全部文件
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {creating && (
        <div className="flex items-center gap-1 px-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="文件夹名称"
            className="h-7 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
          />
        </div>
      )}

      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          children={folders.filter((f) => f.parentFolderId === folder.id)}
          allFolders={folders}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          level={0}
        />
      ))}
    </div>
  );
}
