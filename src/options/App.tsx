import { useState } from 'react';

import { PRESET_IDS, type PresetId } from '../domain/generatorData';
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
import { translate, type MessageKey, type UiLanguagePref } from '../shared/i18n';
import { I18nProvider, useI18n } from '../shared/i18n/react';
import { useCoreData, type CoreData } from '../ui/hooks';
import { EmptyState, LogoMark, SectionCard, StatusBanner } from '../ui/components';
import { btn, inputCls, labelCls, selectCls } from '../ui/classes';

interface Status {
  kind: 'success' | 'error' | 'info';
  text: string;
}

const PRESET_MESSAGE_KEYS: Record<PresetId, MessageKey> = {
  de: 'presetDe',
  us: 'presetUs',
  uk: 'presetUk',
  jp: 'presetJp',
};

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

  if (!data) {
    return <div className="p-8 text-sm text-zinc-400">{translate('loading')}</div>;
  }

  return (
    <I18nProvider preferred={data.settings.uiLanguage}>
      <OptionsApp data={data} reload={reload} />
    </I18nProvider>
  );
}

function OptionsApp({ data, reload }: { data: CoreData; reload: () => void }): React.ReactNode {
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<Persona | null>(null);
  const [preset, setPreset] = useState<PresetId>('de');
  const [seed, setSeed] = useState('');
  const [status, setStatus] = useState<Status | null>(null);

  const activeId = data.settings.activePersonaId;

  const presetLabel = (id: PresetId): string => t(PRESET_MESSAGE_KEYS[id]);

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
      text: t('generatedFromPreset', {
        preset: presetLabel(preset),
        seed: parsedSeed,
      }),
    });
  };

  const setUiLanguage = (value: string): void => {
    void updateSettings(storage, { uiLanguage: value as UiLanguagePref }).then(reload);
  };

  const handleSaveDraft = async (): Promise<void> => {
    if (!draft) return;
    if (!draft.data.identity.firstName.trim() || !draft.data.identity.lastName.trim()) {
      setStatus({ kind: 'error', text: t('nameRequired') });
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
    setStatus({ kind: 'success', text: t('personaSaved', { name: persona.name }) });
  };

  const handleExport = (): void => {
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
        setStatus({ kind: 'error', text: t('notExportFile') });
        return;
      }
      for (const persona of parsed.personas) {
        if (typeof persona?.id !== 'string' || typeof persona?.data?.contact?.email !== 'string')
          continue;
        await storage.savePersona({ ...persona, updatedAt: Date.now() });
      }
      reload();
      setStatus({ kind: 'success', text: t('importedCount', { count: parsed.personas.length }) });
    } catch (error) {
      setStatus({
        kind: 'error',
        text: t('importFailed', { error: error instanceof Error ? error.message : String(error) }),
      });
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        <LogoMark size={28} />
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-zinc-100">ProfilePack</h1>
          <p className="text-xs text-zinc-500">{t('optionsTagline', { version: APP_VERSION })}</p>
        </div>
      </header>

      {status ? (
        <div className="mb-4">
          <StatusBanner kind={status.kind}>{status.text}</StatusBanner>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <SectionCard
          title={t('generateSection')}
          action={<span className="text-[11px] text-zinc-500">{t('syntheticNote')}</span>}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelCls} htmlFor="preset-select">
                {t('presetLabel')}
              </label>
              <select
                id="preset-select"
                className={`${selectCls} w-48`}
                value={preset}
                onChange={(event) => setPreset(event.target.value as PresetId)}
              >
                {PRESET_IDS.map((id) => (
                  <option key={id} value={id}>
                    {presetLabel(id)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="seed-input">
                {t('seedLabel')}
              </label>
              <input
                id="seed-input"
                className={`${inputCls} w-40`}
                placeholder={t('seedPlaceholder')}
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
              />
            </div>
            <button type="button" className={btn.primary} onClick={startGenerate}>
              {t('generate')}
            </button>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                setDraft(emptyDraft());
                setStatus(null);
              }}
            >
              {t('newBlankPersona')}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">{t('deterministicNote')}</p>
        </SectionCard>

        {draft ? (
          <PersonaEditor
            draft={draft}
            onChange={setDraft}
            onSave={() => void handleSaveDraft()}
            onCancel={() => setDraft(null)}
          />
        ) : null}

        <SectionCard title={t('personasCount', { count: data.personas.length })}>
          {data.personas.length === 0 ? (
            <EmptyState title={t('noPersonasYet')} hint={t('noPersonasHint')} />
          ) : (
            <ul className="flex flex-col gap-1">
              {data.personas.map((persona) => (
                <li
                  key={persona.id}
                  className={`flex flex-wrap items-center gap-2 rounded-md px-2.5 py-2 ${
                    persona.id === activeId
                      ? 'border border-emerald-900 bg-emerald-950/40'
                      : 'bg-zinc-900'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {persona.name}
                      {persona.id === activeId ? (
                        <span className="ms-2 rounded bg-emerald-900 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                          {t('activeBadge')}
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {persona.locale} · {persona.country} ·{' '}
                      {t('updatedAt', {
                        date: new Date(persona.updatedAt).toLocaleString(locale),
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {persona.id !== activeId ? (
                      <button
                        type="button"
                        className={btn.ghost}
                        onClick={() => void activatePersona(storage, persona.id).then(reload)}
                      >
                        {t('activate')}
                      </button>
                    ) : null}
                    <button type="button" className={btn.ghost} onClick={() => startEdit(persona)}>
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className={btn.ghost}
                      onClick={() => void duplicatePersona(storage, persona.id).then(reload)}
                    >
                      {t('duplicate')}
                    </button>
                    <button
                      type="button"
                      className={btn.danger}
                      onClick={() => {
                        if (!window.confirm(t('deletePersonaConfirm', { name: persona.name })))
                          return;
                        void deletePersona(storage, persona.id).then(reload);
                      }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard title={t('importExportSection')}>
            <p className="mb-3 text-xs text-zinc-400">{t('exportNote')}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn.secondary} onClick={handleExport}>
                {t('exportJson')}
              </button>
              <label className={btn.secondary}>
                {t('importJson')}
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

          <SectionCard title={t('settingsSection')}>
            <div className="flex flex-col gap-2 text-xs text-zinc-300">
              <label className="flex items-center justify-between gap-2">
                <span>{t('scanAutomatically')}</span>
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
                <span>{t('showBadge')}</span>
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
                <span>{t('fillMode')}</span>
                <select
                  className={`${selectCls} w-40`}
                  aria-label={t('fillMode')}
                  value={data.settings.fillMode}
                  onChange={(event) =>
                    void updateSettings(storage, {
                      fillMode: event.target.value === 'emptyOnly' ? 'emptyOnly' : 'overwrite',
                    }).then(reload)
                  }
                >
                  <option value="overwrite">{t('fillModeOverwrite')}</option>
                  <option value="emptyOnly">{t('fillModeEmptyOnly')}</option>
                </select>
              </label>
              <label className="flex items-center justify-between gap-2">
                <span>{t('uiLanguageLabel')}</span>
                <select
                  className={`${selectCls} w-40`}
                  aria-label={t('uiLanguageAria')}
                  value={data.settings.uiLanguage}
                  onChange={(event) => setUiLanguage(event.target.value)}
                >
                  <option value="auto">{t('uiLanguageAuto')}</option>
                  <option value="fa">{t('uiLanguageFa')}</option>
                  <option value="en">{t('uiLanguageEn')}</option>
                </select>
              </label>
              <button
                type="button"
                className={`${btn.danger} mt-2`}
                onClick={() => {
                  if (!window.confirm(t('deleteAllConfirm'))) return;
                  void storage.clearAll().then(() => {
                    reload();
                    setStatus({ kind: 'info', text: t('allDataDeleted') });
                  });
                }}
              >
                {t('deleteAllData')}
              </button>
            </div>
          </SectionCard>
        </div>

        <TemplatesCard
          templates={data.templates}
          onDelete={(id) => void deleteTemplate(storage, id).then(reload)}
        />

        <SectionCard title={t('aboutSection')}>
          <p className="text-xs leading-relaxed text-zinc-400">
            {t('aboutBody')} {t('aboutShortcutPrefix')}{' '}
            <kbd className="rounded bg-zinc-800 px-1">Alt</kbd> +{' '}
            <kbd className="rounded bg-zinc-800 px-1">P</kbd> {t('aboutShortcutSuffix')}
          </p>
        </SectionCard>
      </div>

      <footer className="mt-8 border-t border-zinc-800 pt-4 text-center text-[11px] text-zinc-600">
        {t('optionsFooter', { version: APP_VERSION })}
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
  const { t } = useI18n();
  return (
    <SectionCard title={t('templatesCount', { count: templates.length })}>
      {templates.length === 0 ? (
        <EmptyState title={t('noTemplatesYet')} hint={t('noTemplatesHintOptions')} />
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
                  {template.hostname ?? t('anySite')}
                  {template.pathPattern
                    ? ` · ${t('pathPattern', { pattern: template.pathPattern })}`
                    : ''}{' '}
                  · {t('mappingCount', { count: template.mappings.length })}
                </p>
              </div>
              <button type="button" className={btn.danger} onClick={() => onDelete(template.id)}>
                {t('delete')}
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
  const { t } = useI18n();
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
    <SectionCard title={draft.id ? t('editPersona', { name: draft.name }) : t('newPersona')}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="f-first">
            {t('field.firstName')} *
          </label>
          <input
            id="f-first"
            {...inputProps(draft.data.identity.firstName)}
            onChange={(e) => setIdentity({ firstName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-middle">
            {t('field.middleName')}
          </label>
          <input
            id="f-middle"
            {...inputProps(draft.data.identity.middleName)}
            onChange={(e) => setIdentity({ middleName: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-last">
            {t('field.lastName')} *
          </label>
          <input
            id="f-last"
            {...inputProps(draft.data.identity.lastName)}
            onChange={(e) => setIdentity({ lastName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-full">
            {t('field.fullName')}
          </label>
          <input
            id="f-full"
            {...inputProps(draft.data.identity.fullName)}
            onChange={(e) => setIdentity({ fullName: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-username">
            {t('field.username')}
          </label>
          <input
            id="f-username"
            {...inputProps(draft.data.identity.username)}
            onChange={(e) => setIdentity({ username: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-dob">
            {t('field.dateOfBirth')} (YYYY-MM-DD)
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
            {t('field.email')}
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
            {t('field.phone')}
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
            {t('field.country')}
          </label>
          <input
            id="f-country"
            {...inputProps(draft.data.address.country)}
            onChange={(e) => setAddress({ country: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-state">
            {t('field.state')}
          </label>
          <input
            id="f-state"
            {...inputProps(draft.data.address.state)}
            onChange={(e) => setAddress({ state: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-city">
            {t('field.city')}
          </label>
          <input
            id="f-city"
            {...inputProps(draft.data.address.city)}
            onChange={(e) => setAddress({ city: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-postal">
            {t('field.postalCode')}
          </label>
          <input
            id="f-postal"
            {...inputProps(draft.data.address.postalCode)}
            onChange={(e) => setAddress({ postalCode: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls} htmlFor="f-street">
            {t('field.street')}
          </label>
          <input
            id="f-street"
            {...inputProps(draft.data.address.street)}
            onChange={(e) => setAddress({ street: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-addr1">
            {t('field.addressLine1')}
          </label>
          <input
            id="f-addr1"
            {...inputProps(draft.data.address.addressLine1)}
            onChange={(e) => setAddress({ addressLine1: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-addr2">
            {t('field.addressLine2')}
          </label>
          <input
            id="f-addr2"
            {...inputProps(draft.data.address.addressLine2)}
            onChange={(e) => setAddress({ addressLine2: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-company">
            {t('field.company')}
          </label>
          <input
            id="f-company"
            {...inputProps(draft.data.business.company)}
            onChange={(e) => setBusiness({ company: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-job">
            {t('field.jobTitle')}
          </label>
          <input
            id="f-job"
            {...inputProps(draft.data.business.jobTitle)}
            onChange={(e) => setBusiness({ jobTitle: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-dept">
            {t('field.department')}
          </label>
          <input
            id="f-dept"
            {...inputProps(draft.data.business.department)}
            onChange={(e) => setBusiness({ department: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-vat">
            {t('field.vatId')}
          </label>
          <input
            id="f-vat"
            {...inputProps(draft.data.business.vatId)}
            onChange={(e) => setBusiness({ vatId: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-website">
            {t('field.website')}
          </label>
          <input
            id="f-website"
            {...inputProps(draft.data.optional.website)}
            onChange={(e) => setOptional({ website: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="f-locale">
            {t('localeLabel')}
          </label>
          <input
            id="f-locale"
            {...inputProps(draft.locale)}
            onChange={(e) => set({ locale: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls} htmlFor="f-notes">
            {t('field.notes')}
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
            {t('personaDisplayName')}
          </label>
          <input
            id="f-name"
            {...inputProps(draft.name)}
            placeholder={t('displayNamePlaceholder')}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" className={btn.primary} onClick={onSave}>
          {t('savePersona')}
        </button>
        <button type="button" className={btn.secondary} onClick={onCancel}>
          {t('cancel')}
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
