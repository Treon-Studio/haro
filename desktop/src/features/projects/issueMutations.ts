import { useMutation, useQueryClient } from "@tanstack/react-query";

// import { relayClient } from "@/shared/api/relayClient";
import { signRelayEvent } from "@/shared/api/tauri";
import { KIND_GIT_ISSUE } from "@/shared/constants/kinds";
import type { Project } from "./hooks";
import { buildGitIssueTags } from "./projectIssues.mjs";

import { realtimeSocketClient as simpleSocket } from "@/shared/api/realtimeSocketClient";
import type { RelayEvent } from "@/shared/api/types";

type CreateProjectIssueInput = {
  title: string;
  body: string;
};

export type ProjectEventPublisher = Pick<typeof simpleSocket, "publishEvent">;

export async function publishProjectIssue(
  project: Project,
  input: CreateProjectIssueInput,
  publisher: ProjectEventPublisher = simpleSocket,
) {
  const event = await signRelayEvent({
    kind: KIND_GIT_ISSUE,
    content: input.body.trim(),
    tags: buildGitIssueTags({
      repoAddress: project.repoAddress,
      repoOwner: project.owner,
      title: input.title,
    }),
  });
  const result = await publisher.publishEvent(event as RelayEvent);
  if (
    result &&
    typeof result === "object" &&
    "accepted" in result &&
    !result.accepted
  ) {
    throw new Error(result.message || "Relay rejected issue creation.");
  }
  return event.id;
}

export function useCreateProjectIssueMutation(
  project: Project | null | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectIssueInput) => {
      if (!project) throw new Error("No project selected.");
      return publishProjectIssue(project, input);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project", project?.id ?? "none", "issues"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["projects", "work-items"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["projects", "activity-summaries"],
        }),
      ]);
    },
  });
}
