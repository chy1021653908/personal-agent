"use client";

import { useState } from "react";
import { ShieldCheck, ShieldX, Pencil, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ActionRequest, ReviewConfig } from "langchain";

export type HitlApproval = {
  actionRequest: ActionRequest;
  reviewConfig: ReviewConfig;
  index: number;
};

interface PendingApprovalCardProps {
  request: HitlApproval;
  isProcessing?: boolean;
  onApprove?: (index: number, editedArgs?: Record<string, unknown>) => void;
  onReject?: (index: number, reason?: string) => void;
}

export function PendingApprovalCard({
  request,
  isProcessing = false,
  onApprove,
  onReject,
}: PendingApprovalCardProps) {
  const t = useTranslations();
  const { actionRequest, reviewConfig, index } = request;
  const [isEditing, setIsEditing] = useState(false);
  const [editedArgs, setEditedArgs] = useState<Record<string, unknown>>(
    actionRequest.args
  );
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const allowedDecisions = reviewConfig.allowedDecisions ?? [];
  const allowApprove = allowedDecisions.includes("approve");
  const allowReject = allowedDecisions.includes("reject");
  const canEdit = allowedDecisions.includes("edit");
  const canApprove = Boolean(onApprove) && !isProcessing;
  const canReject = Boolean(onReject) && !isProcessing;

  const handleApprove = () => {
    if (!onApprove) return;
    const changed =
      JSON.stringify(editedArgs) !== JSON.stringify(actionRequest.args);
    onApprove(index, changed ? editedArgs : undefined);
  };

  const handleReject = () => {
    if (!onReject) return;
    onReject(index, rejectReason || t("pendingApproval.defaultRejectReason"));
    setShowRejectInput(false);
  };

  return (
    <Card className="max-w-[80%] animate-in fade-in duration-300">
      <CardHeader className="gap-1">
        <CardTitle className="text-sm flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          {t("pendingApproval.title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {actionRequest.description || t("pendingApproval.description")}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {t("pendingApproval.toolLabel")}{" "}
          <span className="font-medium text-foreground">{actionRequest.name}</span>
        </div>
        {isEditing ? (
          <div className="space-y-2">
            {Object.entries(editedArgs).map(([key, value]) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs text-muted-foreground">{key}</label>
                <Input
                  value={String(value ?? "")}
                  onChange={(e) =>
                    setEditedArgs({ ...editedArgs, [key]: e.target.value })
                  }
                  disabled={isProcessing}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {Object.entries(actionRequest.args).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span className="font-mono text-muted-foreground/80 min-w-[72px]">
                  {key}:
                </span>
                <span className="text-foreground break-all">
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
        {showRejectInput && (
          <Input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t("pendingApproval.rejectReasonPlaceholder")}
            disabled={isProcessing}
          />
        )}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleApprove} disabled={!canApprove}>
                <ShieldCheck />
                {t("pendingApproval.saveAndContinue")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditedArgs(actionRequest.args);
                  setIsEditing(false);
                }}
                disabled={isProcessing}
              >
                {t("pendingApproval.cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleApprove}
                disabled={!canApprove || !allowApprove}
              >
                <ShieldCheck />
                {t("pendingApproval.allow")}
              </Button>
              {canEdit && (
                <Button
                  variant="secondary"
                  onClick={() => setIsEditing(true)}
                  disabled={isProcessing}
                >
                  <Pencil />
                  {t("pendingApproval.edit")}
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() =>
                  showRejectInput ? handleReject() : setShowRejectInput(true)
                }
                disabled={!canReject || !allowReject}
              >
                <ShieldX />
                {t("pendingApproval.reject")}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
