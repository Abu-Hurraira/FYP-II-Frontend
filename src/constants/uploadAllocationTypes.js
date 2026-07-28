export const UPLOAD_ALLOCATION_TYPES = [
  { key: "clos", label: "CLOs" },
  { key: "cloPloMapping", label: "CLO-PLO Map" },
  { key: "cloTaskMapping", label: "Task-CLO Map" },
  { key: "mid", label: "Mid" },
  { key: "final", label: "Final" },
  { key: "folderTemplate", label: "Folder Template" },
];

export const EMPTY_UPLOAD_ALLOCATION_ROW = {
  clos: false,
  cloPloMapping: false,
  cloTaskMapping: false,
  mid: false,
  final: false,
  folderTemplate: false,
};

export const FULL_UPLOAD_ALLOCATION_ROW = {
  clos: true,
  cloPloMapping: true,
  cloTaskMapping: true,
  mid: true,
  final: true,
  folderTemplate: true,
};
