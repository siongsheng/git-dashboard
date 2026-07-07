export function taskSlug(title: string, taskId: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${slug || "task"}-${taskId}`;
}

export function agentBranchName(title: string, taskId: number): string {
  return `agent/${taskSlug(title, taskId)}`;
}
