export function DueDateCell({ dueDate }: { dueDate: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let cls = 'due-date';
  let label = dueDate;
  if (diffDays < 0) {
    cls += ' due-overdue';
    label += ' ⚠ Overdue';
  } else if (diffDays <= 2) {
    cls += ' due-soon';
    label += ' · Due soon';
  }

  return <span className={cls}>{label}</span>;
}