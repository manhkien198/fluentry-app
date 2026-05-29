export type NetworkIssueKind = "timeout" | "offline" | "server" | "unknown";

export function getPracticeRetryMessage(
  kind: NetworkIssueKind,
  t: (key: string) => string,
) {
  switch (kind) {
    case "timeout":
      return t("practice.timeout_retry");
    case "offline":
      return t("practice.offline_retry");
    case "server":
      return t("practice.server_retry");
    default:
      return t("practice.retry_generic");
  }
}
