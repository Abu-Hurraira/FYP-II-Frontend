const ListRowActions = ({ onEdit, onDelete, editLabel = "Edit", deleteLabel = "Delete" }) => (
  <div className="flex shrink-0 items-center gap-2">
    {onEdit ? (
      <button
        type="button"
        onClick={onEdit}
        className="flex h-8 w-8 items-center justify-center rounded-md text-base text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
        aria-label={editLabel}
        title={editLabel}
      >
        ✎
      </button>
    ) : null}
    {onDelete ? (
      <button
        type="button"
        onClick={onDelete}
        className="flex h-8 w-8 items-center justify-center rounded-md text-base text-red-500 transition hover:bg-red-50 hover:text-red-700"
        aria-label={deleteLabel}
        title={deleteLabel}
      >
        🗑
      </button>
    ) : null}
  </div>
);

export default ListRowActions;
