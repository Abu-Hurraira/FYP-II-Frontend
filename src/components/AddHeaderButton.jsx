const AddHeaderButton = ({ label, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className={`app-btn-primary shrink-0 ${className}`.trim()}
  >
    {label}
  </button>
);

export default AddHeaderButton;

