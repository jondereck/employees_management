import React from "react";

interface ChipProps {
  label: string;
  onRemove?: () => void;
}

const Chip: React.FC<ChipProps> = ({ label, onRemove }) => {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: "16px",
        backgroundColor: "#e0e0e0",
        marginRight: "8px",
      }}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          style={{
            marginLeft: "8px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontWeight: "bold",
          }}
          aria-label={`Remove ${label}`}
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Chip;
