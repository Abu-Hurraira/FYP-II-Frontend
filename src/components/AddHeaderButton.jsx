const AddHeaderButton = ({ label, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${className}`}
  >
    {label}
  </button>
);

export default AddHeaderButton;
