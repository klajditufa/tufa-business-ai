import * as React from "react";
import { cn } from "@/lib/utils";

/* Komponentë bazë në stilin shadcn/ui (pa CLI). Zëvendësohen me shadcn kur të shtohet registry. */

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border bg-card text-foreground hover:bg-muted",
    ghost: "bg-transparent hover:bg-muted",
    danger: "bg-danger text-white hover:opacity-90",
  };
  const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-base" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none ring-accent/40 placeholder:text-muted-foreground focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none ring-accent/40 focus:ring-2",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium text-foreground", className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-medium text-muted-foreground", className)} {...props} />;
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const tones = {
    neutral: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    danger: "bg-danger/15 text-danger",
    info: "bg-accent/15 text-accent",
  };
  return (
    <span
      className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

export function Alert({
  tone = "info",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: "info" | "warning" | "danger" | "success" }) {
  const tones = {
    info: "border-accent/30 bg-accent/10 text-foreground",
    warning: "border-warning/40 bg-warning/10 text-foreground",
    danger: "border-danger/40 bg-danger/10 text-foreground",
    success: "border-success/40 bg-success/10 text-foreground",
  };
  return <div role="alert" className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone], className)} {...props} />;
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
      <p className="font-medium text-foreground/80">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Titulli i faqes si te cis-client-2: pllakë me ikonë + titull + nëntitull. */
export function PageTitle({
  icon: Icon,
  title,
  subtitle,
  tone = "neutral",
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: "neutral" | "teal" | "indigo" | "orange" | "violet";
  children?: React.ReactNode;
}) {
  const tones = {
    neutral: "border border-border bg-card text-muted-foreground",
    teal: "bg-success/15 text-success",
    indigo: "bg-accent/15 text-accent",
    orange: "bg-warning/15 text-warning",
    violet: "bg-violet-500/15 text-violet-500",
  };
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-4">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Kartë përmbledhëse (Fatura / Pa TVSH / TVSH / Totali). */
export function Stat({ label, value, hint, highlight = false }: { label: string; value: React.ReactNode; hint?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-card px-4 py-3", highlight ? "border-primary" : "border-border")}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-bold tabular">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
