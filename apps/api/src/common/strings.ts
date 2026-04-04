export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function randomOtp(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

export function randomToken(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildHandle(name: string): string {
  const normalized = slugify(name).replace(/-/g, '');
  return normalized || `teacher${Math.random().toString(36).slice(2, 7)}`;
}

export function extractMentions(content: string): string[] {
  const matches = content.match(/@([a-z0-9_.-]+)/gi) ?? [];
  return matches.map((match) => match.slice(1).toLowerCase());
}
