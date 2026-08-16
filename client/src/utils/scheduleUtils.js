export const sortSchedules = (schedules) => {
  const getStatusPriority = (s) => {
    if (s.queueStatus === 'active') return 1;
    if (s.queueStatus === 'paused') return 2;
    if (s.status === 'published' && s.queueStatus !== 'closed') return 3;
    if (s.queueStatus === 'closed') return 4;
    return 5;
  };

  const isCompleted = (s) => s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended';

  const current = schedules.filter(s => s.status !== 'draft' && !isCompleted(s));
  current.sort((a, b) => {
    const priorityA = getStatusPriority(a);
    const priorityB = getStatusPriority(b);
    if (priorityA !== priorityB) return priorityA - priorityB;

    const dateA = new Date(a.clinicDate).getTime();
    const dateB = new Date(b.clinicDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    
    return (a.openingTime || '').localeCompare(b.openingTime || '');
  });

  const drafts = schedules.filter(s => s.status === 'draft');
  drafts.sort((a, b) => {
    const dateA = new Date(a.clinicDate).getTime();
    const dateB = new Date(b.clinicDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a.openingTime || '').localeCompare(b.openingTime || '');
  });

  const completed = schedules.filter(s => s.status !== 'draft' && isCompleted(s));
  completed.sort((a, b) => {
    const dateA = new Date(a.clinicDate).getTime();
    const dateB = new Date(b.clinicDate).getTime();
    if (dateA !== dateB) return dateB - dateA; // descending
    return (a.openingTime || '').localeCompare(b.openingTime || ''); // ascending
  });

  return [...current, ...drafts, ...completed];
};
