import { useTranslation as useAppTranslation } from "@/shared/i18n";
export const WORK_ITEM_TABLE_GRID_CLASS =
  "grid w-full grid-cols-[minmax(0,1fr)_5.5rem_4.5rem_3rem_5rem_1.5rem] items-center gap-x-3";

export function ProjectsWorkItemTableHeader({
  itemLabel,
  typeLabel,
}: {
  itemLabel: string;
  typeLabel: string;
}) {
  const { t: localize } = useAppTranslation();

  return (
    <thead className="sr-only">
      <tr>
        <th scope="col">{itemLabel}</th>
        <th scope="col">{typeLabel}</th>
        <th scope="col">{localize("Status")}</th>
        <th scope="col">{localize("Replies")}</th>
        <th scope="col">{localize("Updated")}</th>
        <th scope="col">{localize("Actions")}</th>
      </tr>
    </thead>
  );
}
