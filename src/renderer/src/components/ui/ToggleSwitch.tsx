import React from "react";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  labelClassName?: string;
}

export const ToggleSwitch = React.forwardRef<
  HTMLButtonElement,
  ToggleSwitchProps
>(
  (
    {
      checked,
      onChange,
      id,
      disabled = false,
      className = "",
      label,
      labelClassName = "",
    },
    ref,
  ) => {
    const handleClick = () => {
      if (!disabled) {
        onChange(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Space or Enter toggles the switch
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <div className="flex items-center gap-3">
        <button
          ref={ref}
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={`
            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
            rounded-full border-2 border-transparent
            transition-colors duration-200 ease-out
            focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
            disabled:cursor-not-allowed disabled:opacity-50
            ${checked ? "bg-accent" : "bg-muted"}
            ${className}
          `}
        >
          {/* Toggle thumb */}
          <span
            className={`
              pointer-events-none inline-block h-5 w-5 transform
              rounded-full bg-card shadow-md
              transition-transform duration-200 ease-out
              ${checked ? "translate-x-5" : "translate-x-0"}
            `}
            aria-hidden="true"
          />
        </button>

        {label && (
          <label
            htmlFor={id}
            className={`
              select-none text-sm font-medium text-foreground
              cursor-pointer
              ${disabled ? "opacity-50 cursor-not-allowed" : ""}
              ${labelClassName}
            `}
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

ToggleSwitch.displayName = "ToggleSwitch";
