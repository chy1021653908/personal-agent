"use client";

import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputHeader,
  PromptInputTools,
  PromptInputButton,
  PromptInputCommand,
  PromptInputCommandEmpty,
  PromptInputCommandGroup,
  PromptInputCommandInput,
  PromptInputCommandItem,
  PromptInputCommandList,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  CheckIcon,
  GlobeIcon,
  AtSignIcon,
  DatabaseIcon,
  XIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { KnowledgeBase } from "@/types";
import type { ChatModelProvider } from "@/lib/ai/model-provider";
import { CHAT_MODELS } from "@/lib/ai/chat-models";

interface ChatInputProps {
  onSend: (
    message: string,
    model?: string,
    options?: { enableWebSearch?: boolean; modelProvider?: ChatModelProvider },
  ) => void;
  isLoading: boolean;
  placeholder?: string;
  knowledgeBases: KnowledgeBase[];
  selectedKbId: string | null;
  onSelectKnowledgeBase: (kbId: string | null) => void;
  /** 默认 true；工作流检索页可关闭知识库入口 */
  showKnowledgeBase?: boolean;
  /** 默认 true；工作流检索页可关闭「Search」开关（页面本身已是联网检索） */
  showWebSearchToggle?: boolean;
  /** 与 `showWebSearchToggle` 搭配；默认 false（关联网） */
  initialUseWebSearch?: boolean;
  /** 初始模型 ID（仅首次挂载生效） */
  initialModelId?: string;
}

function PromptInputAttachmentsDisplay() {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id);
    },
    [attachments],
  );

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((file) => (
        <Attachment
          key={file.id}
          data={file}
          onRemove={() => handleRemove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

export function ChatInput({
  onSend,
  isLoading,
  placeholder,
  knowledgeBases,
  selectedKbId,
  onSelectKnowledgeBase,
  showKnowledgeBase = true,
  showWebSearchToggle = true,
  initialUseWebSearch = false,
  initialModelId,
}: ChatInputProps) {
  const t = useTranslations();
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(() => {
    if (
      initialModelId &&
      CHAT_MODELS.some((item) => item.id === initialModelId)
    ) {
      return initialModelId;
    }
    return CHAT_MODELS[0].id;
  });
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(initialUseWebSearch);
  const [contextPickerOpen, setContextPickerOpen] = useState(false);

  const handleSubmit = (message: PromptInputMessage) => {
    const text = (message.text ?? input).trim();
    if (!text || isLoading) return;
    if (showWebSearchToggle) {
      onSend(text, model, {
        enableWebSearch: useWebSearch,
        modelProvider: selectedModelProvider,
      });
    } else {
      onSend(text, model, { modelProvider: selectedModelProvider });
    }
    setInput("");
  };
  const submitStatus = (isLoading ? "streaming" : "ready") as
    | "submitted"
    | "streaming"
    | "ready"
    | "error";

  const selectedModel = useMemo(
    () => CHAT_MODELS.find((m) => m.id === model),
    [model],
  );
  const selectedModelProvider = selectedModel?.modelProvider;
  const suggestions = useMemo(
    () => [
      t("chat.input.suggestions.hello"),
      t("chat.input.suggestions.latestAiNews"),
    ],
    [t],
  );
  const resolvedPlaceholder = placeholder ?? t("chat.input.placeholder");
  const getModelName = useCallback(
    (name: string) =>
      name === "__MINIMAX_DEFAULT__" ? t("chat.input.defaultModelName") : name,
    [t],
  );
  const selectedKnowledgeBase = useMemo(
    () => knowledgeBases.find((kb) => kb.id === selectedKbId) ?? null,
    [knowledgeBases, selectedKbId],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (!suggestion.trim() || isLoading) return;
      if (showWebSearchToggle) {
        onSend(suggestion, model, {
          enableWebSearch: useWebSearch,
          modelProvider: selectedModelProvider,
        });
      } else {
        onSend(suggestion, model, { modelProvider: selectedModelProvider });
      }
    },
    [
      isLoading,
      model,
      onSend,
      selectedModelProvider,
      showWebSearchToggle,
      useWebSearch,
    ],
  );

  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);

  const handleModelSelect = useCallback((modelId: string) => {
    setModel(modelId);
    setModelSelectorOpen(false);
  }, []);

  const isSubmitDisabled = useMemo(
    () => !input.trim() || isLoading,
    [input, isLoading],
  );

  return (
    <div className="relative z-10 p-4">
      <div className="mx-auto max-w-3xl space-y-3">
        <Suggestions className="px-1">
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onClick={handleSuggestionClick}
            />
          ))}
        </Suggestions>
        <PromptInput
          onSubmit={handleSubmit}
          globalDrop
          multiple
          className="[&_[data-slot=input-group]]:rounded-2xl [&_[data-slot=input-group]]:bg-[var(--prompt-input-bg)]"
        >
          <PromptInputHeader className="w-full justify-start px-2.5 pt-3">
            <PromptInputAttachmentsDisplay />
            {showKnowledgeBase && (
              <DropdownMenu
                open={contextPickerOpen}
                onOpenChange={setContextPickerOpen}
              >
                <DropdownMenuTrigger asChild>
                  <PromptInputButton variant="outline" size="sm">
                    <AtSignIcon />
                    {!selectedKnowledgeBase && (
                      <span>{t("chat.input.addContext")}</span>
                    )}
                  </PromptInputButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[340px] p-1"
                  sideOffset={8}
                >
                  <PromptInputCommand>
                    <PromptInputCommandInput
                      placeholder={t("chat.input.search")}
                    />
                    <PromptInputCommandList>
                      <PromptInputCommandEmpty>
                        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                          {t("chat.input.emptyKnowledgeBase")}
                        </div>
                      </PromptInputCommandEmpty>
                      <PromptInputCommandGroup
                        heading={t("chat.input.knowledgeBases")}
                      >
                        {knowledgeBases.map((kb) => (
                          <PromptInputCommandItem
                            key={kb.id}
                            value={kb.name}
                            onSelect={() => {
                              onSelectKnowledgeBase(kb.id);
                              setContextPickerOpen(false);
                            }}
                            className="rounded-md"
                          >
                            <DatabaseIcon className="size-4 text-muted-foreground" />
                            <span className="truncate">{kb.name}</span>
                          </PromptInputCommandItem>
                        ))}
                      </PromptInputCommandGroup>
                    </PromptInputCommandList>
                  </PromptInputCommand>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {showKnowledgeBase && selectedKnowledgeBase && (
              <button
                type="button"
                onClick={() => onSelectKnowledgeBase(null)}
                className="inline-flex max-w-[260px] items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-sm text-secondary-foreground hover:bg-secondary/80"
              >
                <DatabaseIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">
                  {selectedKnowledgeBase.name}
                </span>
                <XIcon className="size-4 shrink-0" />
              </button>
            )}
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setInput(e.target.value)
              }
              placeholder={resolvedPlaceholder}
              aria-label={t("chat.input.textAria")}
              className="px-3 py-2 text-sm"
            />
          </PromptInputBody>
          <PromptInputFooter className="flex items-center justify-between gap-2 px-2 pb-2 pt-0">
            <PromptInputTools>
              {/* <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu> */}
              {/* <SpeechInput
                className="shrink-0"
                onTranscriptionChange={handleTranscriptionChange}
                size="icon-sm"
                variant="ghost"
              /> */}
              {showWebSearchToggle && (
                <PromptInputButton
                  onClick={toggleWebSearch}
                  variant={useWebSearch ? "default" : "ghost"}
                >
                  <GlobeIcon size={16} />
                  <span>{t("chat.input.search")}</span>
                </PromptInputButton>
              )}
              <ModelSelector
                open={modelSelectorOpen}
                onOpenChange={setModelSelectorOpen}
              >
                <ModelSelectorTrigger asChild>
                  <PromptInputButton>
                    {selectedModel?.chefSlug && (
                      <ModelSelectorLogo provider={selectedModel.chefSlug} />
                    )}
                    {selectedModel?.name && (
                      <ModelSelectorName>
                        {getModelName(selectedModel.name)}
                      </ModelSelectorName>
                    )}
                  </PromptInputButton>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  <ModelSelectorInput
                    placeholder={t("chat.input.searchModel")}
                  />
                  <ModelSelectorList>
                    {[
                      {
                        key: "openai",
                        title: "OpenAI Compatible",
                      },
                      {
                        key: "anthropic",
                        title: "Anthropic Compatible",
                      },
                    ].map(({ key, title }) => {
                      const groupModels = CHAT_MODELS.filter(
                        (m) => m.category === key,
                      );
                      if (groupModels.length === 0) return null;

                      return (
                        <ModelSelectorGroup heading={title} key={key}>
                          {groupModels.map((m) => (
                            <ModelSelectorItem
                              key={m.id}
                              value={m.id}
                              onSelect={() => handleModelSelect(m.id)}
                            >
                              <ModelSelectorLogo provider={m.chefSlug} />
                              <ModelSelectorName>
                                {getModelName(m.name)}
                              </ModelSelectorName>
                              <ModelSelectorLogoGroup>
                                {m.providers.map((provider) => (
                                  <ModelSelectorLogo
                                    key={provider}
                                    provider={provider}
                                  />
                                ))}
                              </ModelSelectorLogoGroup>
                              {model === m.id ? (
                                <CheckIcon className="ml-auto size-4" />
                              ) : (
                                <div className="ml-auto size-4" />
                              )}
                            </ModelSelectorItem>
                          ))}
                        </ModelSelectorGroup>
                      );
                    })}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={isSubmitDisabled}
              status={submitStatus}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
