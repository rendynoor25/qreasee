import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";
import { cn } from "../lib/utils";

export function Button({
  variant = "ghost",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        variant === "primary" && "bg-lens-visual text-ink-950 hover:bg-brand-300",
        variant === "outline" && "border border-ink-600 text-ink-200 hover:border-ink-400 hover:text-ink-100",
        variant === "danger" && "bg-state-over/90 text-white hover:bg-state-over",
        variant === "ghost" && "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
        className,
      )}
    />
  );
}

export function IconButton({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md border text-ink-300 transition-colors",
        active
          ? "border-lens-visual/70 bg-lens-visual/15 text-lens-visual"
          : "border-transparent hover:border-ink-700 hover:bg-ink-800 hover:text-ink-100",
        className,
      )}
    />
  );
}

export function Panel({
  title,
  children,
  actions,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-ink-800 bg-ink-900/70", className)}>
      {title && (
        <header className="flex items-center justify-between border-b border-ink-800 px-3 py-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-300">{title}</h3>
          {actions}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 flex items-center justify-between text-[11px] text-ink-400">
        <span>{label}</span>
        {hint && <span className="text-ink-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-ink-700 bg-ink-950/70 px-2 py-1.5 text-xs text-ink-100 outline-none placeholder:text-ink-500 focus:border-lens-visual/70";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, className)} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, "min-h-[64px] resize-y", className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputClass, "appearance-none", className)}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md border border-ink-800 bg-ink-950/40 px-2.5 py-1.5 text-left text-xs text-ink-200 hover:border-ink-600"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors",
          checked ? "bg-lens-visual" : "bg-ink-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-ink-950 transition-all",
            checked ? "left-3.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function Chip({
  status,
  label,
  value,
  title,
  onClick,
  active,
}: {
  status?: string;
  label: ReactNode;
  value?: ReactNode;
  title?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
        active ? "border-lens-visual/70" : "border-ink-700",
        status === "over" && "border-state-over/60 bg-state-over/10",
        status === "near" && "border-state-near/60 bg-state-near/10",
        status === "ok" && "border-state-ok/50 bg-state-ok/10",
        status === "under" && "border-state-near/60 bg-state-near/10",
        status === "needs-input" && "border-ink-700 bg-ink-800/40",
        onClick && "hover:border-ink-500",
      )}
    >
      <span className="text-ink-400">{label}</span>
      {value !== undefined && <span className="qr-nowrap font-mono text-ink-100">{value}</span>}
      {status && (
        <span
          className={cn(
            "qr-nowrap rounded-full px-1.5 text-[10px]",
            status === "over" && "text-state-over",
            status === "near" && "text-state-near",
            status === "ok" && "text-state-ok",
            status === "under" && "text-state-near",
            status === "needs-input" && "text-ink-500",
          )}
        >
          {status}
        </span>
      )}
    </button>
  );
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-5 shadow-panel qr-fade",
            wide ? "w-[min(900px,92vw)]" : "w-[min(460px,92vw)]",
          )}
        >
          <Dialog.Title className="text-sm font-semibold text-ink-100">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1 text-xs text-ink-400">{description}</Dialog.Description>
          )}
          <div className="mt-4">{children}</div>
          <Dialog.Close className="absolute right-3 top-3 rounded p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            ✕
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const TabsRoot = Tabs.Root;
export const TabsList = ({ className, ...props }: Tabs.TabsListProps) => (
  <Tabs.List
    {...props}
    className={cn("mb-2 flex gap-1 rounded-lg border border-ink-800 bg-ink-950/50 p-1", className)}
  />
);
export const TabsTrigger = ({ className, ...props }: Tabs.TabsTriggerProps) => (
  <Tabs.Trigger
    {...props}
    className={cn(
      "flex-1 rounded-md px-2 py-1 text-[11px] text-ink-400 transition-colors data-[state=active]:bg-ink-800 data-[state=active]:text-ink-100",
      className,
    )}
  />
);
export const TabsContent = Tabs.Content;
