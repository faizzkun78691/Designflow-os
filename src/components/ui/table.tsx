import {
  forwardRef,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";
import { cn } from "../../utils/cn";

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Pins the header row to the top while scrolling. Defaults to false. */
  stickyHeader?: boolean;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(function Table(
  { className, stickyHeader = false, ...props },
  ref,
) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-(--border)">
      <table
        ref={ref}
        className={cn(
          "w-full border-collapse text-sm",
          stickyHeader &&
            "[&_thead]:sticky [&_thead]:top-0 [&_thead]:bg-(--surface) [&_thead]:shadow-[0_1px_0_0_var(--border)]",
          className,
        )}
        {...props}
      />
    </div>
  );
});

export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-(--surface-2)", className)} {...props} />;
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("bg-(--surface)", className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-(--border) transition-colors last:border-0 hover:bg-(--surface-2)",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-12 whitespace-nowrap px-4 text-left align-middle font-display text-xs font-semibold uppercase tracking-wider text-(--fg-subtle)",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3 align-middle text-(--fg)", className)}
      {...props}
    />
  );
}
