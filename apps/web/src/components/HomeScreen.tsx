import { useState, type ReactNode } from "react";
import { makeTranslator, STARTER_TEMPLATES, type Project, type TemplateId } from "@qreasee/shared";
import { useApp } from "../state/store";
import { DocumentStore } from "@qreasee/document";
import { ifcToDocState, importQrs, parseIfc } from "@qreasee/export";
import { LogoMark } from "./Logo";
import { StudioPanel } from "./StudioPanel";
import { Modal } from "./ui";
import { readFileAsBytes } from "../lib/utils";

const prettify = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function TemplateGlyph({ id }: { id: TemplateId | "blank" | "sample" }) {
  const common = {
    width: 40,
    height: 40,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (id === "house")
    return (
      <svg {...common}>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  if (id === "cafe")
    return (
      <svg {...common}>
        <path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
        <path d="M17 9h2a2 2 0 0 1 0 4h-2" />
        <path d="M4 21h14" />
      </svg>
    );
  if (id === "school")
    return (
      <svg {...common}>
        <path d="M2 9l10-4 10 4-10 4z" />
        <path d="M6 11v5c0 1 3 3 6 3s6-2 6-3v-5" />
      </svg>
    );
  if (id === "dormitory")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <path d="M3 12h18M9 4v16M15 4v16" />
      </svg>
    );
  if (id === "sample")
    return (
      <svg {...common}>
        <path d="M12 3l9 5-9 5-9-5z" />
        <path d="M3 13l9 5 9-5" />
      </svg>
    );
  return (
    <svg {...common}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function Card({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-xl border border-ink-800 bg-ink-900/70 p-4 text-left transition-colors hover:border-brand-400/60 hover:bg-ink-900"
    >
      <span className="text-ink-300 transition-colors group-hover:text-brand-400">{icon}</span>
      <span className="text-sm font-semibold text-ink-100">{title}</span>
      <span className="text-[11px] leading-snug text-ink-400">{description}</span>
    </button>
  );
}

export function HomeScreen() {
  const lang = useApp((s) => s.lang);
  const tr = makeTranslator(lang);
  const theme = useApp((s) => s.theme);
  const toggleTheme = useApp((s) => s.toggleTheme);
  const setLang = useApp((s) => s.setLang);
  const openTemplate = useApp((s) => s.openTemplate);
  const openBlank = useApp((s) => s.openBlank);
  const loadSample = useApp((s) => s.loadSample);
  const loadSampleHouse = useApp((s) => s.loadSampleHouse);
  const projects = useApp((s) => s.projects);
  const openProject = useApp((s) => s.openProject);
  const deleteProject = useApp((s) => s.deleteProject);
  const studioKit = useApp((s) => s.studioKit);
  const replaceWorkspace = useApp((s) => s.replaceWorkspace);
  const setScreen = useApp((s) => s.setScreen);
  const setStatus = useApp((s) => s.setStatus);
  const [studioOpen, setStudioOpen] = useState(false);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const payload = importQrs(await readFileAsBytes(file));
      replaceWorkspace(payload.project, DocumentStore.deserialize(payload.store));
      setScreen("workspace");
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    }
  };

  const onImportIfc = async (file: File | undefined) => {
    if (!file) return;
    try {
      const model = parseIfc(await file.text());
      if (model.rooms.length === 0 && model.walls.length === 0) {
        setStatus("No rooms or walls found in that IFC.");
        return;
      }
      const state = ifcToDocState(model);
      const project: Project = {
        id: `ifc-${Date.now()}`,
        studioId: studioKit.id,
        name: file.name.replace(/\.ifc$/i, "") || "Imported IFC",
        location: { lat: 0, lng: 0 },
        northAngle: 0,
        units: "mm",
        buildingType: "house",
      };
      replaceWorkspace(project, new DocumentStore(state, "Main"));
      setScreen("workspace");
      useApp.getState().setMode("concept");
      setStatus(
        `Imported ${model.rooms.length} rooms, ${model.walls.length} walls, ${model.openings.length} openings, ${model.slabs.length} slabs, ${model.levels.length} storeys.` +
          (model.skipped.roofs + model.skipped.stairs > 0
            ? ` (${model.skipped.roofs} roofs / ${model.skipped.stairs} stairs not imported yet.)`
            : ""),
      );
    } catch (err) {
      setStatus(`IFC import failed: ${(err as Error).message}`);
    }
  };

  const when = (ts: number) =>
    new Date(ts).toLocaleString(lang === "id" ? "id-ID" : "en-US");

  return (
    <div className="min-h-screen overflow-y-auto bg-ink-950 px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-10 flex items-center gap-3">
          <LogoMark className="h-10 w-10 text-ink-100" />
          <div className="mr-auto">
            <div className="text-xl font-bold tracking-tight text-brand-400">Qreasee</div>
            <div className="text-[11px] text-ink-400">{tr("app.tagline")}</div>
          </div>
          <button
            onClick={() => setStudioOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-ink-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-ink-500"
          >
            <span
              className="h-2.5 w-2.5 rounded-full border border-ink-600"
              style={{ background: studioKit.identity.primaryColor }}
            />
            {tr("studio.menu")}
          </button>
          <button
            onClick={() => setLang(lang === "en" ? "id" : "en")}
            className="rounded-md border border-ink-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-ink-500"
          >
            {lang.toUpperCase()}
          </button>
          <button
            onClick={toggleTheme}
            className="rounded-md border border-ink-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-ink-500"
          >
            {theme === "dark" ? "◐" : "◑"}
          </button>
        </header>

        <h1 className="text-2xl font-semibold text-ink-100">{tr("home.title")}</h1>
        <p className="mb-6 mt-1 text-sm text-ink-400">{tr("home.tagline")}</p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STARTER_TEMPLATES.map((t) => (
            <Card
              key={t.id}
              icon={<TemplateGlyph id={t.id} />}
              title={t.name[lang]}
              description={t.description[lang]}
              onClick={() => openTemplate(t.id)}
            />
          ))}
          <Card
            icon={<TemplateGlyph id="blank" />}
            title={tr("home.blank")}
            description={tr("home.blankDesc")}
            onClick={openBlank}
          />
          <Card
            icon={<TemplateGlyph id="sample" />}
            title={tr("home.sample")}
            description={tr("home.sampleDesc")}
            onClick={loadSample}
          />
          <Card
            icon={<TemplateGlyph id="house" />}
            title={tr("home.sampleHouse")}
            description={tr("home.sampleHouseDesc")}
            onClick={loadSampleHouse}
          />
        </div>

        <section className="mt-10">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
            {tr("home.projects")}
          </div>
          {projects.length > 0 && (
            <button
              onClick={() => openProject(projects[0].id)}
              className="mb-3 flex w-full max-w-md items-center gap-3 rounded-xl border border-brand-400/40 bg-ink-900/70 p-3 text-left transition-colors hover:border-brand-400/70"
            >
              <span className="text-brand-400">▶</span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-wide text-ink-500">
                  {tr("home.continue")}
                </span>
                <span className="block truncate text-sm font-semibold text-ink-100">
                  {projects[0].name}
                </span>
                <span className="block truncate text-[11px] text-ink-400">
                  {when(projects[0].savedAt)}
                </span>
              </span>
            </button>
          )}
          {projects.length > 0 ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="group flex items-center gap-2 rounded-xl border border-ink-800 bg-ink-900/70 p-2 pr-3 transition-colors hover:border-brand-400/50"
                >
                  <button
                    onClick={() => openProject(p.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left"
                  >
                    <span className="shrink-0 text-ink-300 group-hover:text-brand-400">
                      <svg
                        width={26}
                        height={26}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 11l9-7 9 7" />
                        <path d="M5 10v10h14V10" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-100">
                        {p.name}
                      </span>
                      <span className="block truncate text-[11px] text-ink-400">
                        {prettify(p.buildingType)} · {when(p.savedAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => deleteProject(p.id)}
                    title={tr("common.remove")}
                    className="shrink-0 rounded p-1 text-ink-600 opacity-0 transition-opacity hover:bg-ink-800 hover:text-ink-200 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-600">{tr("home.noRecent")}</p>
          )}
        </section>

        <section className="mt-10">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink-700 px-4 py-2 text-xs text-ink-300 hover:border-ink-500">
            <input
              type="file"
              accept=".qrs,.zip"
              className="hidden"
              onChange={(e) => void onImport(e.target.files?.[0])}
            />
            {tr("home.import")}
          </label>
          <label className="ml-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-ink-700 px-4 py-2 text-xs text-ink-300 hover:border-ink-500">
            <input
              type="file"
              accept=".ifc"
              className="hidden"
              onChange={(e) => void onImportIfc(e.target.files?.[0])}
            />
            {tr("home.importIfc")}
          </label>
          <span className="ml-3 text-[11px] text-ink-600">{tr("home.importHint")}</span>
        </section>
      </div>

      <Modal open={studioOpen} onOpenChange={setStudioOpen} title={tr("studio.title")} wide>
        <StudioPanel />
      </Modal>
    </div>
  );
}
