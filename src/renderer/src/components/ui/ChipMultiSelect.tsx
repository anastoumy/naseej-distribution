import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";

interface ChipItem {
  id: string;
  label: string;
}

interface ChipMultiSelectProps<T extends ChipItem> {
  items: T[];
  selectedIds: Set<string>;
  onToggleItem: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  className?: string;
  emptyMessage?: string;
  selectAllLabel?: string;
  clearAllLabel?: string;
}

const Chip = React.memo<{
  id: string;
  label: string;
  isSelected: boolean;
  onToggle: () => void;
}>(({ id, label, isSelected, onToggle }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={`
        px-3 py-2 rounded-full text-sm font-medium
        transition-all duration-150 ease-out
        focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background
        ${
          isSelected
            ? "bg-accent text-accent-foreground shadow-md"
            : "border-2 border-border bg-input text-foreground hover:border-accent/50"
        }
      `}
    >
      <span className="flex items-center gap-2">
        {label}
        {isSelected && <span className="ml-1">✓</span>}
      </span>
    </button>
  );
});

Chip.displayName = "Chip";

/**
 * Generic chip multi-select component
 * Displays items as selectable chips in a flex wrap layout
 * Includes Select All / Clear All buttons above the grid
 * Shows item count below
 */
export const ChipMultiSelect = React.memo(
  React.forwardRef<HTMLDivElement, ChipMultiSelectProps<any>>(
    (
      {
        items,
        selectedIds,
        onToggleItem,
        onSelectAll,
        onClearAll,
        className = "",
        emptyMessage,
        selectAllLabel,
        clearAllLabel,
      },
      ref,
    ) => {
      const { t } = useTranslation();
      const resolvedEmptyMessage =
        emptyMessage || t("components.chipMultiSelect.noItems");
      const resolvedSelectAllLabel =
        selectAllLabel || t("components.chipMultiSelect.selectAll");
      const resolvedClearAllLabel =
        clearAllLabel || t("components.chipMultiSelect.clearAll");

      const handleToggleItem = useCallback(
        (id: string) => {
          onToggleItem(id);
        },
        [onToggleItem],
      );

      const handleSelectAll = useCallback(() => {
        onSelectAll();
      }, [onSelectAll]);

      const handleClearAll = useCallback(() => {
        onClearAll();
      }, [onClearAll]);

      if (items.length === 0) {
        return (
          <div
            ref={ref}
            className={`
              rounded-lg border-2 border-dashed border-gray-300
              p-4 text-center text-gray-500
              ${className}
            `}
          >
            {resolvedEmptyMessage}
          </div>
        );
      }

      return (
        <div ref={ref} className={className}>
          {/* Select All / Clear All buttons */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`
                px-3 py-1.5 rounded text-sm font-medium
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                bg-blue-100 text-blue-700 hover:bg-blue-200
              `}
            >
              {resolvedSelectAllLabel}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className={`
                px-3 py-1.5 rounded text-sm font-medium
                transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                bg-gray-200 text-gray-700 hover:bg-gray-300
              `}
            >
              {resolvedClearAllLabel}
            </button>
          </div>

          {/* Chip grid */}
          <div className="mb-4 flex flex-wrap gap-2">
            {items.map((item) => (
              <Chip
                key={item.id}
                id={item.id}
                label={item.label}
                isSelected={selectedIds.has(item.id)}
                onToggle={() => handleToggleItem(item.id)}
              />
            ))}
          </div>

          {/* Selection counter */}
          <div className="text-sm text-gray-600">
            {selectedIds.size}{" "}
            {selectedIds.size !== 1
              ? t("components.chipMultiSelect.items")
              : t("components.chipMultiSelect.item")}{" "}
            {t("components.chipMultiSelect.selected")}
          </div>
        </div>
      );
    },
  ),
) as React.ForwardRefExoticComponent<
  ChipMultiSelectProps<any> & React.RefAttributes<HTMLDivElement>
>;

ChipMultiSelect.displayName = "ChipMultiSelect";
