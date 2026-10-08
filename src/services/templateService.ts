import type { FormTemplate } from '../domain/template';
import { templateMatchesUrl, templateSpecificity } from '../domain/template';
import { createId } from '../shared/id';
import type { StorageService } from '../storage/types';

export async function listTemplates(storage: StorageService): Promise<FormTemplate[]> {
  return (await storage.getTemplates()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveTemplate(
  storage: StorageService,
  template: Omit<FormTemplate, 'createdAt' | 'updatedAt'> &
    Partial<Pick<FormTemplate, 'createdAt' | 'updatedAt'>>,
): Promise<FormTemplate> {
  const existing = await storage.getTemplates();
  const previous = existing.find((t) => t.id === template.id);
  const now = Date.now();
  const saved: FormTemplate = {
    ...template,
    id: template.id || createId('template'),
    createdAt: previous?.createdAt ?? template.createdAt ?? now,
    updatedAt: now,
  };
  await storage.saveTemplate(saved);
  await storage.pushRecentAction({
    id: createId('action'),
    at: now,
    kind: 'template',
    summary: `Template saved (${saved.name})`,
  });
  return saved;
}

export async function deleteTemplate(storage: StorageService, id: string): Promise<void> {
  await storage.deleteTemplate(id);
  await storage.pushRecentAction({
    id: createId('action'),
    at: Date.now(),
    kind: 'template',
    summary: 'Template deleted',
  });
}

/** Picks the most specific template matching the URL, if any. */
export function findTemplateForUrl(
  templates: FormTemplate[],
  urlString: string,
): FormTemplate | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  const matches = templates.filter((t) => templateMatchesUrl(t, url));
  if (matches.length === 0) return null;
  return matches.sort(
    (a, b) => templateSpecificity(b) - templateSpecificity(a) || b.updatedAt - a.updatedAt,
  )[0] as FormTemplate;
}
