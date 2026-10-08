import { useState } from 'react';

import { PRESET_IDS, PRESETS, type PresetId } from '../domain/generatorData';
import { generatePersona, randomSeed } from '../domain/generator';
import type { Persona, PersonaData } from '../domain/persona';
import type { FormTemplate } from '../domain/template';
import {
  deletePersona,
  duplicatePersona,
  activatePersona,
  savePersona,
} from '../services/personaService';
import { deleteTemplate } from '../services/templateService';
import { updateSettings } from '../services/settingsService';
import { storage } from '../services/container';
import { createId } from '../shared/id';
import { APP_VERSION } from '../shared/version';
import { useCoreData } from '../ui/hooks';
import { EmptyState, LogoMark, SectionCard, StatusBanner } from '../ui/components';
import { btn, inputCls, labelCls, selectCls } from '../ui/classes';

interface Status {
  kind: 'success' | 'error' | 'info';
  text: string;
}

function emptyDraft(): Persona {
  const now = Date.now();
  return {
    id: '',
    name: '',
    locale: 'de-DE',
    country: 'Germany',
    createdAt: now,
    updatedAt: now,
    data: {
      identity: { firstName: '', lastName: '', fullName: '', username: '', dateOfBirth: '' },
      contact: { email: '', phone: '' },
      address: { country: '', city: '', postalCode: '' },
      business: {},
      optional: {},
    },
  };
}

export function App(): React.ReactNode {
  const { data, reload } = useCoreData();
  const [draft, setDraft] = useState<Persona | null>(null);
  const [preset, setPreset] = useState<PresetId>('de');
  const [seed, setSeed] = useState('');
  const [status, setStatus] = useState<Status | null>(null);

  const activeId = data?.settings.activePersonaId;

  const startEdit = (persona: Persona): void => {
    setDraft(structuredClone(persona));
    setStatus(null);
  };

  const startGenerate = (): void => {
    const parsedSeed = seed.trim() ? hashSeed(seed.trim()) : randomSeed();
    const generated = generatePersona(preset, { seed: parsedSeed });
    setDraft(generated);
    setStatus({
      kind: 'info',
      text: `Generated persona from ${PRESETS[preset].meta.label} (seed: ${parsedSeed}). Review and save.`,
    });
  };

  const handleSaveDraft = async (): Promise<void> => {
    if (!draft) return;
    if (!draft.data.identity.firstName.trim() || !draft.data.identity.lastName.trim()) {
      setStatus({ kind: 'error', text: 'First name and last name are required.' });
      return;
    }
    const persona: Persona = {
      ...draft,
      id: draft.id || createId('persona'),
      name: draft.name.trim() || draft.data.identity.fullName,
      locale: draft.locale.trim() || 'en-US',
      country: draft.country.trim() || draft.data.address.country,
      data: {
        ...draft.data,
        address: { ...draft.data.address, country: draft.data.address.country },
      },
    };
    await savePersona(storage, persona);
    setDraft(null);
    reload();
    setStatus({ kind: 'success', text: `Persona saved: ${persona.name}` });
  };

  const handleExport = (): void => {
    if (!data) return;
    const payload = {
      kind: 'profilepack-export',
      version: 1,
      exportedAt: new Date().toISOString(),
      personas: data.personas,
      scenarios: data.scenarios,
      templates: data.templates,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `profilepack-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        kind?: string;
        personas?: Persona[];
      };
      if (parsed.kind !== 'profilepack-export' || !Array.isArray(parsed.personas)) {
        setStatus({ kind: 'error', text: 'Not a ProfilePack export file.' });
        return;
      }
      for (const persona of parsed.personas) {
        if (typeof persona?.id !== 'string' || typeof persona?.data?.contact?.email !== 'string')
          continue;
        await storage.savePersona({ ...persona, updatedAt: Date.now() });
      }
      reload();
      setStatus({ kind: 'success', text: `Imported ${parsed.personas.length} persona(s).` });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: `Import failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

  if (!data) {
    return <div className="p-8 text-sm text-zinc-400">Loading ProfilePack…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <LogoMark size={28} />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-zinc-100">ProfilePack</h1>
          <p className="text-xs text-zinc-500">v{APP_VERSION} · local-first · MIT licensed</p>
        </div>
      </header>

      {status ? (
        <div className="mb-4">
          <StatusBanner kind={status.kind}>{status.text}</StatusBanner>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Generate a persona"
          action={
            <span className="text-[11px] text-zinc-500">
              All data is synthetic · emails use example.test
            </span>
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelCls} htmlFor="preset-select">
                Preset
              </label>
              <select
                id="preset-select"
                className={`${selectCls} w-48`}
                value={preset}
                onChange={(event) => setPreset(event.target.value as PresetId)}
              >
                {PRESET_IDS.map((id) => (
                  <option key={id} value={id}>
                    {PRESETS[id].meta.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="seed-input">
                Seed (optional)
              </label>
              <input
                id="seed-input"
                className={`${inputCls} w-40`}
                placeholder="e.g. 42"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
              />
            </div>
            <button type="button" className={btn.primary} onClick={startGenerate}>
              Generate
            </button>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                setDraft(emptyDraft());
                setStatus(null);
              }}
            >
              New blank persona
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Same seed + same preset = exactly the same persona. Useful for reproducible test runs.
          </p>
        </SectionCard>

        {draft ? (
          <PersonaEditor
            draft={draft}
            onChange={setDraft}
            onSave={() => void handleSaveDraft()}
            onCancel={() => setDraft(null)}
          />
        ) : null}

        <SectionCard title={`Personas (${data.personas.length})`}>
          {data.personas.length === 0 ? (
            <EmptyState title="No personas yet" hint="Generate one from a preset above." />
          ) : (
            <ul className="flex flex-col gap-1">
              {data.personas.map((persona) => (
                <li
                  key={persona.id}
                  className={`flex flex-wrap items-center gap-2 rounded-md px-2.5 py-2 ${
                    persona.id === activeId
                      ? 'bg-emerald-950/40 border border-emerald-900'
                      : 'bg-zinc-900'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {persona.name}
                      {persona.id === activeId ? (
                        <span className="ml-2 rounded bg-emerald-900 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                          ACTIVE
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {persona.locale} · {persona.country} · updated{' '}
                      {new Date(persona.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {persona.id !== activeId ? (
                      <button
                        type="button"
                        className={btn.ghost}
                        onClick={() => void activatePersona(storage, persona.id).then(reload)}
                      >
                        Activate
                      </button>
                    ) : null}
                    <button type="button" className={btn.ghost} onClick={() => startEdit(persona)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={btn.ghost}
                      onClick={() => void duplicatePersona(storage, persona.id).then(reload)}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className={btn.danger}
                      onClick={() => {
                        if (!window.confirm(`Delete persona "${persona.name}"?`)) return;
                        void deletePersona(storage, persona.id).then(reload);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title="Import / Export">
            <p className="mb-3 text-xs text-zinc-400">
              Everything stays on this device. Exports are plain JSON files you can commit to test
              repositories or share with your team.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn.secondary} onClick={handleExport}>
                Export JSON
              </button>
              <label className={btn.secondary}>
                Import JSON
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImport(file);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Settings">
            <div className="flex flex-col gap-2 text-xs text-zinc-300">
              <label className="flex items-center justify-between gap-2">
                <span>Scan pages automatically</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-500"
                  checked={data.settings.autoScan}
                  onChange={(event) =>
                    void updateSettings(storage, { autoScan: event.target.checked }).then(reload)
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Show field count badge</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-500"
                  checked={data.settings.badgeEnabled}
                  onChange={(event) =>
                    void updateSettings(storage, { badgeEnabled: event.target.checked }).then(
                      reload,
                    )
                  }
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>Fill mode</span>
                <select
                  className={`${selectCls} w-40`}
                  aria-label="Fill mode"
                  value={data.settings.fillMode}
                  onChange={(event) =>
                    void updateSettings(storage, {
                      fillMode: event.target.value === 'emptyOnly' ? 'emptyOnly' : 'overwrite',
                    }).then(reload)
                  }
                >
                  <option value="overwrite">Overwrite</option>
                  <option value="emptyOnly">Empty fields only</option>
                </select>
              </label>
              <button
                type="button"
                className={`${btn.danger} mt-2`}
                onClick={() => {
                  if (!window.confirm('Delete ALL ProfilePack data on this device?')) return;
                  void storage.clearAll().then(() => {
                    reload();
                    setStatus({ kind: 'info', text: 'All local data deleted.' });
                  });
                }}
              >
                Delete all data
              </button>
            </div>
          </SectionCard>
        </div>

        <TemplatesCard
          templates={data.templates}
          onDelete={(id) => void deleteTemplate(storage, id).then(reload)}
        />

        <SectionCard title="About">
          <p className="text-xs leading-relaxed text-zinc-400">
            ProfilePack is an open-source, local-first Chrome extension for developers and QA
            engineers. It never submits forms, never fills passwords or payment fields, and never
            sends persona data anywhere. Keyboard shortcut:{' '}
            <kbd className="rounded bg-zinc-800 px-1">Alt</kbd> +{' '}
            <kbd className="rounded bg-zinc-800 px-1">P</kbd> (changeable at
            chrome://extensions/shortcuts).
          </p>
        </SectionCard>
      </div>

      <footer className="mt-8 border-t border-zinc-800 pt-4 text-center text-[11px] text-zinc-600">
        ProfilePack v{APP_VERSION} — build one synthetic test persona, reuse it across the web.
      </footer>
    </div>
  );
}

function TemplatesCard({
  templates,
  onDelete,
}: {
  templates: FormTemplate[];
  onDelete: (id: string) => void;
}): React.ReactNode {
  return (
    <SectionCard title={`Form templates (${templates.length})`}>
      {templates.length === 0 ? (
        <EmptyState title="No templates yet" hint="Learn a form from the popup to create one." />
      ) : (
        <ul className="flex flex-col gap-1">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-center justify-between gap-2 rounded-md bg-zinc-900 px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{template.name}</p>
                <p className="truncate text-[11px] text-zinc-500">
                  {template.hostname ?? 'any site'}
                  {template.pathPattern ? ` · path: ${template.pathPattern}` : ''} ·{' '}
                  {template.mappings.length} mapping(s)
                </p>
              </div>
              <button type="button" className={btn.danger} onClick={() => onDelete(template.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function PersonaEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Persona;
  onChange: (persona: Persona) => void;
  onSave: () => void;
  onCancel: () => void;
}): React.ReactNode {
  const set = (patch: Partial<Persona>): void => onChange({ ...draft, ...patch });
  const setIdentity = (patch: Partial<PersonaData['identity']>): void =>
    onChange({ ...draft, data: { ...draft.data, identity: { ...draft.data.identity, ...patch } } });
  const setContact = (patch: Partial<PersonaData['contact']>): void =>
    onChange({ ...draft, data: { ...draft.data, contact: { ...draft.data.contact, ...patch } } });
  const setAddress = (patch: Partial<PersonaData['address']>): void =>
    onChange({ ...draft, data: { ...draft.data, address: { ...draft.data.address, ...patch } } });
  const setBusiness = (patch: Partial<PersonaData['business']>): void =>
    onChange({ ...draft, data: { ...draft.data, business: { ...draft.data.business, ...patch } } });
  const setOptional = (patch: Partial<PersonaData['optional']>): void =>
    onChange({ ...draft, data: { ...draft.data, optional: { ...draft.data.optional, ...patch } } });

  const inputProps = (value: string | undefined) => ({
    className: inputCls,
    value: value ?? '',
  });

  return (
    <SectionCard title={draft.id ? `Edit: ${draft.name}` : 'New persona'}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="f-first">
            First name *
          </label>
          <input
            id="f-first"
            {...inputProps(draft.data.identity.firstName)}
            onChange={(e) => setIdentity({ firstName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-middle">
            Middle name
          </label>
          <input
            id="f-middle"
            {...inputProps(draft.data.identity.middleName)}
            onChange={(e) => setIdentity({ middleName: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-last">
            Last name *
          </label>
          <input
            id="f-last"
            {...inputProps(draft.data.identity.lastName)}
            onChange={(e) => setIdentity({ lastName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-full">
            Full name
          </label>
          <input
            id="f-full"
            {...inputProps(draft.data.identity.fullName)}
            onChange={(e) => setIdentity({ fullName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-username">
            Username
          </label>
          <input
            id="f-username"
            {...inputProps(draft.data.identity.username)}
            onChange={(e) => setIdentity({ username: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-dob">
            Date of birth (YYYY-MM-DD)
          </label>
          <input
            id="f-dob"
            type="date"
            {...inputProps(draft.data.identity.dateOfBirth)}
            onChange={(e) => setIdentity({ dateOfBirth: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-email">
            Email
          </label>
          <input
            id="f-email"
            type="email"
            {...inputProps(draft.data.contact.email)}
            onChange={(e) => setContact({ email: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-phone">
            Phone
          </label>
          <input
            id="f-phone"
            type="tel"
            {...inputProps(draft.data.contact.phone)}
            onChange={(e) => setContact({ phone: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-country">
            Country
          </label>
          <input
            id="f-country"
            {...inputProps(draft.data.address.country)}
            onChange={(e) => setAddress({ country: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-state">
            State / region
          </label>
          <input
            id="f-state"
            {...inputProps(draft.data.address.state)}
            onChange={(e) => setAddress({ state: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-city">
            City
          </label>
          <input
            id="f-city"
            {...inputProps(draft.data.address.city)}
            onChange={(e) => setAddress({ city: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-postal">
            Postal code
          </label>
          <input
            id="f-postal"
            {...inputProps(draft.data.address.postalCode)}
            onChange={(e) => setAddress({ postalCode: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls} htmlFor="f-street">
            Street
          </label>
          <input
            id="f-street"
            {...inputProps(draft.data.address.street)}
            onChange={(e) => setAddress({ street: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-addr1">
            Address line 1
          </label>
          <input
            id="f-addr1"
            {...inputProps(draft.data.address.addressLine1)}
            onChange={(e) => setAddress({ addressLine1: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-addr2">
            Address line 2
          </label>
          <input
            id="f-addr2"
            {...inputProps(draft.data.address.addressLine2)}
            onChange={(e) => setAddress({ addressLine2: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-company">
            Company
          </label>
          <input
            id="f-company"
            {...inputProps(draft.data.business.company)}
            onChange={(e) => setBusiness({ company: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-job">
            Job title
          </label>
          <input
            id="f-job"
            {...inputProps(draft.data.business.jobTitle)}
            onChange={(e) => setBusiness({ jobTitle: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-dept">
            Department
          </label>
          <input
            id="f-dept"
            {...inputProps(draft.data.business.department)}
            onChange={(e) => setBusiness({ department: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-vat">
            VAT ID
          </label>
          <input
            id="f-vat"
            {...inputProps(draft.data.business.vatId)}
            onChange={(e) => setBusiness({ vatId: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-website">
            Website
          </label>
          <input
            id="f-website"
            {...inputProps(draft.data.optional.website)}
            onChange={(e) => setOptional({ website: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-locale">
            Locale
          </label>
          <input
            id="f-locale"
            {...inputProps(draft.locale)}
            onChange={(e) => set({ locale: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls} htmlFor="f-notes">
            Notes
          </label>
          <textarea
            id="f-notes"
            rows={2}
            className={inputCls}
            value={draft.data.optional.notes ?? ''}
            onChange={(e) => setOptional({ notes: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls} htmlFor="f-name">
            Persona display name
          </label>
          <input
            id="f-name"
            {...inputProps(draft.name)}
            placeholder="Defaults to full name"
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" className={btn.primary} onClick={onSave}>
          Save persona
        </button>
        <button type="button" className={btn.secondary} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </SectionCard>
  );
}

/** Stable seed from an arbitrary seed string. */
function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
