export type RevisionedActionResult<State extends { revision: number }> = {
  conflict: boolean;
  state: State;
};

type RevisionedActionResponse<Result> = {
  data: Result | null;
  error: Error | null;
};

/**
 * Runs an optimistic-concurrency live-room action and transparently retries it
 * against the canonical state returned by the server. A conflict is expected
 * when both teams act between realtime deliveries; it is not a user error.
 */
export async function runRevisionedAction<
  State extends { revision: number },
  Result extends RevisionedActionResult<State>,
>({
  revision,
  execute,
  applyState,
  maxConflictRetries = 2,
  retryConflicts = true,
  applySuccessfulState = true,
  shouldRetryConflict,
}: {
  revision: number;
  execute: (expectedRevision: number) => Promise<RevisionedActionResponse<Result>>;
  applyState: (state: State) => void;
  maxConflictRetries?: number;
  /**
   * Disable for attempt-scoped actions whose input must never be replayed
   * against a newer state generation (for example, an RPS throw after a tie).
   */
  retryConflicts?: boolean | ((state: State) => boolean);
  /** Let realtime deliver successful state when all clients should reveal together. */
  applySuccessfulState?: boolean;
  /** Restrict retries when an action is valid only within one state generation. */
  shouldRetryConflict?: (state: State) => boolean;
}): Promise<RevisionedActionResponse<Result>> {
  let expectedRevision = revision;

  for (let attempt = 0; attempt <= maxConflictRetries; attempt += 1) {
    const response = await execute(expectedRevision);
    if (response.error || !response.data) return response;

    if (response.data.conflict || applySuccessfulState) {
      applyState(response.data.state);
    }
    if (!response.data.conflict) return response;
    if (
      !retryConflicts ||
      (typeof retryConflicts === "function" &&
        !retryConflicts(response.data.state))
    )
      return response;

    expectedRevision = response.data.state.revision;
  }

  return {
    data: null,
    error: new Error(
      "The live room is changing quickly. It is up to date now; please try the action once more.",
    ),
  };
}
