import type { MappingTarget } from './fields';

/** A single website-field → ProfilePack-field binding. */
export interface FieldMapping {
  selector: string;
  /** Website-side label, display only. */
  label?: string;
  target: MappingTarget;
  customValue?: string;
}

/**
 * Form templates are deliberately site-agnostic: they can be bound to
 * a hostname and an optional path pattern, but a template without a
 * hostname applies everywhere (use with care).
 */
export interface FormTemplate {
  id: string;
  name: string;
  hostname?: string;
  pathPattern?: string;
  mappings: FieldMapping[];
  createdAt: number;
  updatedAt: number;
}

/** Glob-lite pattern: `*` matches any character sequence. */
export function pathPatternMatches(pattern: string, pathname: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(pathname);
}

export function templateMatchesUrl(template: FormTemplate, url: URL): boolean {
  if (template.hostname && template.hostname.toLowerCase() !== url.hostname.toLowerCase()) {
    return false;
  }
  if (template.pathPattern && !pathPatternMatches(template.pathPattern, url.pathname)) {
    return false;
  }
  return Boolean(template.hostname || template.pathPattern);
}

/** More specific templates win: hostname beats path-only beats generic. */
export function templateSpecificity(template: FormTemplate): number {
  return (template.hostname ? 2 : 0) + (template.pathPattern ? 1 : 0);
}
