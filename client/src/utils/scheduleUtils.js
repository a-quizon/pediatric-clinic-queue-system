export const sortSchedules = (schedules) => {
  const todayStr = new Date().toLocaleDateString('en-CA');
  const todayFallback = new Date().toDateString();

  const getStatusPriority = (s) => {
    if (s.queueStatus === 'active') return 1;
    if (s.queueStatus === 'paused') return 2;
    if (s.status === 'published' && s.queueStatus !== 'closed') return 3;
    if (s.queueStatus === 'closed') return 4;
    return 5;
  };

  const isCompleted = (s) => s.status === 'completed' || s.queueStatus === 'completed' || s.queueStatus === 'ended';
  const isToday = (s) => s.clinicDate === todayStr || new Date(s.clinicDate).toDateString() === todayFallback;

  const current = schedules.filter(s => s.status !== 'draft' && !isCompleted(s));
  current.sort((a, b) => {
    const dateA = new Date(a.clinicDate).getTime();
    const dateB = new Date(b.clinicDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    
    const timeCompare = (a.openingTime || '').localeCompare(b.openingTime || '');
    if (timeCompare !== 0) return timeCompare;

    return getStatusPriority(a) - getStatusPriority(b);
  });

  const completedToday = schedules.filter(s => s.status !== 'draft' && isCompleted(s) && isToday(s));
  completedToday.sort((a, b) => (a.openingTime || '').localeCompare(b.openingTime || ''));

  const olderCompleted = schedules.filter(s => s.status !== 'draft' && isCompleted(s) && !isToday(s));
  olderCompleted.sort((a, b) => {
    const dateA = new Date(a.clinicDate).getTime();
    const dateB = new Date(b.clinicDate).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return (a.openingTime || '').localeCompare(b.openingTime || '');
  });

  const drafts = schedules.filter(s => s.status === 'draft');
  drafts.sort((a, b) => {
    const dateA = new Date(a.clinicDate).getTime();
    const dateB = new Date(b.clinicDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return (a.openingTime || '').localeCompare(b.openingTime || '');
  });

  return [...current, ...completedToday, ...olderCompleted, ...drafts];
};
