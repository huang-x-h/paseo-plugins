type Branch = { ref: string; name: string };

/** Pick the matching source branch without silently choosing between multiple remotes. */
export function matchingRemote(localRef: string, remotes: Branch[], upstream: string, current: string): string {
  if (!localRef.startsWith("refs/heads/")) return "";
  const name = localRef.slice("refs/heads/".length);
  const matches = remotes.filter((branch) => branch.name.endsWith(`/${name}`));
  if (name === current) {
    const tracked = matches.find((branch) => branch.name === upstream);
    if (tracked) return tracked.ref;
  }
  const origin = matches.find((branch) => branch.name === `origin/${name}`);
  return origin?.ref ?? (matches.length === 1 ? matches[0].ref : "");
}
