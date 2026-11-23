import { useEffect, useState } from "react";
import { detectSyncConflicts } from "./conflicts";
import { useReadOnly } from "./ReadOnlyContext";

export function SyncConflictBanner() {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    detectSyncConflicts()
      .then(setFiles)
      .catch(() => {});
  }, []);

  if (files.length === 0) return null;

  return (
    <div className="banner banner-warning">
      Syncthing оставил конфликтующие копии: {files.join(", ")}. Текущая база
      бэкапится автоматически — можно спокойно открыть папку с данными и
      разобраться, какую версию оставить.
    </div>
  );
}

export function ReadOnlyBanner() {
  const readOnly = useReadOnly();
  if (!readOnly) return null;
  return (
    <div className="banner banner-readonly">
      Только чтение — база открыта в другом месте. Изменения не сохранятся.
    </div>
  );
}
