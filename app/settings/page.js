"use client";

import { useI18n } from "@/lib/i18n";
import { useStore, companyLetter, companyColorId } from "@/lib/store";
import { useAuth, can } from "@/lib/auth";
import {
  useSettings,
  PALETTE,
  ACCENT_OPTIONS,
  AVATAR_COLOR_OPTIONS,
} from "@/lib/settings";
import {
  IconSun,
  IconMoon,
  IconPalette,
  IconCog,
  IconBuilding,
} from "@/components/Icon";
import CompanyAvatar from "@/components/CompanyAvatar";
import ColorPicker from "@/components/ColorPicker";

// ─────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────

function Section({ title, subtitle, icon: Icon, children }) {
  return (
    <section className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
      <div className="px-5 py-4 border-b border-border flex items-start gap-3">
        {Icon && (
          <div className="h-8 w-8 rounded-md bg-background border border-border flex items-center justify-center text-muted shrink-0">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 items-start">
      <div className="sm:col-span-1">
        <div className="text-sm text-text font-medium">{label}</div>
        {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-border bg-background p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              active
                ? "bg-surface text-text border border-border shadow-card"
                : "text-muted hover:text-text"
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Brand preview box — scales font with character count.
function BrandPreviewBox({ initial }) {
  const s = (initial || "M").slice(0, 6).toUpperCase();
  const len = Math.max(s.length, 1);
  const sizeCls =
    len <= 1 ? "text-base" :
    len === 2 ? "text-sm" :
    len === 3 ? "text-[12px]" :
    len === 4 ? "text-[10px]" :
    len === 5 ? "text-[9px]" :
                "text-[8px]";
  return (
    <div className={`h-9 w-9 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-semibold tabular-nums leading-none ${sizeCls}`}>
      {s}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useI18n();
  const { settings, update, reset } = useSettings();
  const { companies, updateCompany } = useStore();
  const { currentUser } = useAuth();

  if (!can(currentUser, "changeSettings")) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-xl font-semibold text-text">{t("settingsTitle")}</h1>
          <p className="text-sm text-muted mt-1">{t("settingsSubtitle")}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-10 text-center shadow-card">
          <div className="mx-auto h-10 w-10 rounded-md bg-background border border-border flex items-center justify-center text-muted mb-3">
            <IconCog className="h-5 w-5" />
          </div>
          <p className="text-sm text-text font-medium">{t("noPermission")}</p>
          <p className="text-xs text-muted mt-1">{t("noPermissionSettings")}</p>
        </div>
      </div>
    );
  }

  const themeOptions = [
    { value: "light", label: t("morningMode"), icon: IconSun },
    { value: "dark",  label: t("nightMode"),   icon: IconMoon },
  ];

  const fontOptions = [
    { value: "sm", label: t("small") },
    { value: "md", label: t("medium") },
    { value: "lg", label: t("large") },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">{t("settingsTitle")}</h1>
          <p className="text-sm text-muted mt-1">{t("settingsSubtitle")}</p>
        </div>
        <button
          onClick={reset}
          className="text-xs px-3 py-1.5 rounded-md border border-border text-muted hover:text-text hover:bg-surfaceHover transition-colors"
        >
          {t("resetDefaults")}
        </button>
      </div>

      {/* Profile */}
      <Section title={t("profile")} subtitle={t("profileSub")} icon={IconCog}>
        <Row label={t("brandName")} hint={t("brandNameHint")}>
          <input
            type="text"
            value={settings.brandName}
            maxLength={40}
            onChange={(e) => update({ brandName: e.target.value })}
            placeholder="Marketing Console"
            className="w-full max-w-sm px-3 py-2 text-sm bg-background border border-border rounded-md text-text placeholder:text-muted focus:outline-none focus:border-accent/60"
          />
        </Row>

        <Row label={t("brandInitial")} hint={t("brandInitialHint")}>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={settings.brandInitial}
              maxLength={6}
              onChange={(e) => update({ brandInitial: e.target.value })}
              placeholder="M"
              className="w-28 px-3 py-2 text-sm text-center bg-background border border-border rounded-md text-text placeholder:text-muted focus:outline-none focus:border-accent/60 uppercase tabular-nums"
            />
            <BrandPreviewBox initial={settings.brandInitial} />
            <span className="text-xs text-muted">{t("preview")}</span>
          </div>
        </Row>

        <Row label={t("brandColor")} hint={t("brandColorHint")}>
          <ColorPicker
            value={settings.accent}
            onChange={(accent) => update({ accent })}
            size="lg"
            label={t("brandColor")}
          />
        </Row>
      </Section>

      {/* Appearance */}
      <Section title={t("appearance")} subtitle={t("appearanceSub")} icon={IconPalette}>
        <Row label={t("theme")} hint={t("themeHint")}>
          <ToggleGroup options={themeOptions} value={settings.theme} onChange={(theme) => update({ theme })} />
        </Row>

        <Row label={t("fontSize")} hint={t("fontSizeHint")}>
          <ToggleGroup options={fontOptions} value={settings.fontSize} onChange={(fontSize) => update({ fontSize })} />
        </Row>
      </Section>

      {/* Companies Display — per-company avatar customization */}
      <Section title={t("companiesDisplay")} subtitle={t("companiesDisplaySub")} icon={IconBuilding}>
        {companies.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted">
            {t("noCompanies")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {companies.map((c) => (
              <div key={c.id} className="px-5 py-4 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-4 items-center">
                {/* Preview */}
                <div className="flex items-center gap-3">
                  <CompanyAvatar company={c} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm text-text font-medium truncate">{c.name}</div>
                    <div className="text-[11px] text-muted">{t("preview")}</div>
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <div className="text-[11px] text-muted mb-1.5">{t("avatarColor")}</div>
                  <ColorPicker
                    value={companyColorId(c)}
                    onChange={(colorId) => updateCompany(c.id, { colorId })}
                    size="sm"
                    label={t("avatarColor")}
                  />
                </div>

                {/* Letter input — up to 4 chars */}
                <div className="lg:w-36">
                  <div className="text-[11px] text-muted mb-1.5">{t("avatarLetter")}</div>
                  <input
                    type="text"
                    value={c.customLetter || ""}
                    maxLength={4}
                    onChange={(e) => updateCompany(c.id, { customLetter: e.target.value })}
                    placeholder={c.name.charAt(0).toUpperCase()}
                    className="w-full px-3 py-2 text-sm text-center bg-background border border-border rounded-md text-text placeholder:text-muted focus:outline-none focus:border-accent/60 uppercase tabular-nums"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
