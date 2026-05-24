import clsx from "clsx";

/**
 * variant: "primary" | "secondary" | "ghost" | "danger"
 * size   : "sm" | "md" | "lg"
 */
export default function Button({
  children,
  variant  = "primary",
  size     = "md",
  full     = false,
  disabled = false,
  onClick,
  className = "",
  type      = "button",
  title,
}) {
  const base = [
    "inline-flex items-center justify-center gap-2 font-semibold rounded-xl",
    "transition-all duration-150 active:scale-[0.97] select-none",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500",
    full ? "w-full" : "",
    disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer",
  ];

  const sizes = {
    sm : "px-3 py-1.5 text-xs",
    md : "px-4 py-2.5 text-sm",
    lg : "px-5 py-3 text-base",
  };

  const variants = {
    primary  : "bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:opacity-90",
    secondary: "bg-surface-700 border border-surface-600 text-slate-200 hover:bg-surface-600",
    ghost    : "border border-surface-600 text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-surface-800",
    danger   : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={clsx(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}
