"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/use-debounce";

export type ComboOption<V extends string | number = string> = {
  value: V;
  label: string;
  description?: string;
  keywords?: string[];
  disabled?: boolean;
  render?: React.ReactNode;
};

type CommonProps<V extends string | number> = {
  value: V | null;
  onChange: (value: V | null, option: ComboOption<V> | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  invalid?: boolean;
  /** Called when user submits a query that matches nothing (creatable). */
  onCreate?: (label: string) => void | Promise<void>;
  createLabel?: (q: string) => string;
  size?: "sm" | "md";
  id?: string;
  align?: "start" | "end";
  contentClassName?: string;
};

type StaticProps<V extends string | number> = CommonProps<V> & {
  options: ComboOption<V>[];
  loadOptions?: undefined;
};

type AsyncProps<V extends string | number> = CommonProps<V> & {
  options?: ComboOption<V>[];
  /** Server-side search. Called with debounced query. */
  loadOptions: (query: string) => Promise<ComboOption<V>[]>;
  /** Option rendering the currently selected value when it's not in the loaded list. */
  selectedOption?: ComboOption<V> | null;
};

export type ComboboxProps<V extends string | number = string> = StaticProps<V> | AsyncProps<V>;

export function Combobox<V extends string | number = string>(props: ComboboxProps<V>) {
  const { value, onChange, placeholder = "Sélectionner…", searchPlaceholder = "Rechercher…", emptyText = "Aucun résultat", disabled, clearable, className, invalid, onCreate, createLabel, size = "md", id, align = "start", contentClassName } = props;
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query, 220);
  const [asyncOptions, setAsyncOptions] = React.useState<ComboOption<V>[]>(props.options ?? []);
  const [loading, setLoading] = React.useState(false);
  const isAsync = typeof props.loadOptions === "function";
  const requestRef = React.useRef(0);

  React.useEffect(() => {
    if (!isAsync || !open) return;
    const load = props.loadOptions!;
    const reqId = ++requestRef.current;
    setLoading(true);
    load(debounced)
      .then((opts) => {
        if (requestRef.current === reqId) setAsyncOptions(opts);
      })
      .catch(() => {
        if (requestRef.current === reqId) setAsyncOptions([]);
      })
      .finally(() => {
        if (requestRef.current === reqId) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, open, isAsync]);

  const staticOptions = !isAsync && "options" in props ? props.options : undefined;
  const options = React.useMemo<ComboOption<V>[]>(() => (isAsync ? asyncOptions : (staticOptions ?? [])), [isAsync, asyncOptions, staticOptions]);
  const listboxId = React.useId();
  const selected = React.useMemo<ComboOption<V> | null>(() => {
    if (value === null || value === undefined) return null;
    const fromList = options.find((o) => o.value === value);
    if (fromList) return fromList;
    if (isAsync && "selectedOption" in props && props.selectedOption && props.selectedOption.value === value) return props.selectedOption;
    return null;
  }, [value, options, isAsync, props]);

  const [creating, setCreating] = React.useState(false);
  const trimmed = query.trim();
  const showCreate = Boolean(onCreate) && trimmed.length > 0 && !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border bg-white text-left text-[13.5px] shadow-xs transition-colors focus-ring disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-ink-muted",
            size === "md" ? "h-9 px-3" : "h-8 px-2.5 text-[13px]",
            invalid ? "border-danger-600" : "border-line-strong hover:border-slate-400",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-ink-faint")}>{selected ? selected.label : placeholder}</span>
          <span className="flex shrink-0 items-center gap-1 text-ink-muted">
            {clearable && selected && !disabled ? (
              <span
                role="button"
                aria-label="Effacer"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null, null);
                }}
                className="rounded p-0.5 hover:bg-slate-100 hover:text-ink"
              >
                <X className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 opacity-60" />
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={4} className={cn("z-50 w-[var(--radix-popover-trigger-width)] min-w-64 overflow-hidden rounded-lg border border-line bg-white shadow-popover data-[state=open]:animate-slide-up", contentClassName)} onOpenAutoFocus={(e) => e.preventDefault()}>
          <Command shouldFilter={!isAsync} loop>
            <div className="flex items-center gap-2 border-b border-line px-2.5">
              <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder={searchPlaceholder} className="h-9 w-full bg-transparent text-[13.5px] outline-none placeholder:text-ink-faint" />
              {loading ? <Loader2 className="size-4 animate-spin text-ink-muted" /> : null}
            </div>
            <Command.List id={listboxId} className="max-h-72 overflow-y-auto p-1">
              {!loading ? <Command.Empty className="px-2 py-6 text-center text-[13px] text-ink-muted">{isAsync && !debounced && options.length === 0 ? "Saisissez un terme pour rechercher" : emptyText}</Command.Empty> : null}
              {options.map((o) => (
                <Command.Item
                  key={String(o.value)}
                  value={String(o.value)}
                  keywords={[o.label, ...(o.keywords ?? [])]}
                  disabled={o.disabled}
                  onSelect={() => {
                    onChange(o.value, o);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-[13px] outline-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-slate-100"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">{o.value === value ? <Check className="size-3.5 text-brand-600" /> : null}</span>
                  {o.render ?? (
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.description ? <span className="block truncate text-[11.5px] text-ink-muted">{o.description}</span> : null}
                    </span>
                  )}
                </Command.Item>
              ))}
              {showCreate ? (
                <Command.Item
                  value={`__create__${trimmed}`}
                  forceMount
                  onSelect={async () => {
                    if (!onCreate) return;
                    setCreating(true);
                    try {
                      await onCreate(trimmed);
                      setOpen(false);
                      setQuery("");
                    } finally {
                      setCreating(false);
                    }
                  }}
                  className="mt-1 flex cursor-pointer select-none items-center gap-2 rounded-md border-t border-line px-2 py-2 text-[13px] text-brand-700 outline-none data-[selected=true]:bg-brand-50"
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  {createLabel ? createLabel(trimmed) : `Créer « ${trimmed} »`}
                </Command.Item>
              ) : null}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
