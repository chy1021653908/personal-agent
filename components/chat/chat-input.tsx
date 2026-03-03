"use client";

import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
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
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputActionAddAttachments,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import { SpeechInput } from "@/components/ai-elements/speech-input";
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
import { CheckIcon, GlobeIcon } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string, model?: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

const SUGGESTIONS = [
  "如何快速熟悉一个陌生代码库？",
  "帮我设计一个个人知识库结构",
  "根据这段文档生成学习计划",
  "把这段技术方案总结成要点",
];

const MODELS = [
  {
    chef: "OpenAI",
    chefSlug: "openai" as const,
    id: "openai/gpt-oss-20b",
    name: "openai/gpt-oss-20b（默认）",
    providers: ["openai"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai" as const,
    id: "gpt-4o",
    name: "GPT-4o（更强）",
    providers: ["openai"],
  },
  {
    chef: "OpenAI",
    chefSlug: "openai" as const,
    id: "gpt-4o-mini",
    name: "GPT-4o mini（更快更省）",
    providers: ["openai"],
  },
  {
    chef: "DeepSeek",
    chefSlug: "deepseek" as const,
    id: "deepseek/deepseek-v3.2-thinking",
    name: "deepseek/deepseek-v3.2-thinking（推理增强）",
    providers: ["deepseek"],
  },
];

function PromptInputAttachmentsDisplay() {
  const attachments = usePromptInputAttachments();

  const handleRemove = useCallback(
    (id: string) => {
      attachments.remove(id);
    },
    [attachments]
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
  placeholder = "输入消息...",
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(MODELS[0].id);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [useWebSearch, setUseWebSearch] = useState(false);

  const handleSubmit = (message: PromptInputMessage) => {
    const text = (message.text ?? input).trim();
    if (!text || isLoading) return;
    onSend(text, model);
    setInput("");
  };
  const submitStatus = (isLoading ? "streaming" : "ready") as
    | "submitted"
    | "streaming"
    | "ready"
    | "error";

  const selectedModel = useMemo(
    () => MODELS.find((m) => m.id === model),
    [model]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (!suggestion.trim() || isLoading) return;
      onSend(suggestion, model);
    },
    [isLoading, model, onSend]
  );

  const handleTranscriptionChange = useCallback((transcript: string) => {
    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
  }, []);

  const toggleWebSearch = useCallback(() => {
    setUseWebSearch((prev) => !prev);
  }, []);

  const handleModelSelect = useCallback((modelId: string) => {
    setModel(modelId);
    setModelSelectorOpen(false);
  }, []);

  const isSubmitDisabled = useMemo(
    () => !input.trim() || isLoading,
    [input, isLoading]
  );

  return (
    <div className="relative z-10 border-t bg-background p-4">
      <div className="mx-auto max-w-3xl space-y-3">
        <Suggestions className="px-1">
          {SUGGESTIONS.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onClick={handleSuggestionClick}
            />
          ))}
        </Suggestions>
        <PromptInput
          onSubmit={handleSubmit}
          className="rounded-[24px] border bg-background p-2 shadow-sm"
          globalDrop
          multiple
        >
          <PromptInputHeader>
            <PromptInputAttachmentsDisplay />
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setInput(e.target.value)
              }
              placeholder={placeholder}
              aria-label="输入消息"
              className="px-3 py-2 text-sm"
            />
          </PromptInputBody>
          <PromptInputFooter className="flex items-center justify-between gap-2 px-2 pb-1 pt-0">
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <SpeechInput
                className="shrink-0"
                onTranscriptionChange={handleTranscriptionChange}
                size="icon-sm"
                variant="ghost"
              />
              <PromptInputButton
                onClick={toggleWebSearch}
                variant={useWebSearch ? "default" : "ghost"}
              >
                <GlobeIcon size={16} />
                <span>Search</span>
              </PromptInputButton>
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
                      <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
                    )}
                  </PromptInputButton>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  <ModelSelectorInput placeholder="搜索模型..." />
                  <ModelSelectorList>
                    {["OpenAI", "DeepSeek"].map((chef) => (
                      <ModelSelectorGroup heading={chef} key={chef}>
                        {MODELS.filter((m) => m.chef === chef).map((m) => (
                          <ModelSelectorItem
                            key={m.id}
                            value={m.id}
                            onSelect={() => handleModelSelect(m.id)}
                          >
                            <ModelSelectorLogo provider={m.chefSlug} />
                            <ModelSelectorName>{m.name}</ModelSelectorName>
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
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
            </PromptInputTools>
            <PromptInputSubmit disabled={isSubmitDisabled} status={submitStatus} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
