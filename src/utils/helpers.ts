export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const calculateDayDifference = (date1: Date, date2: Date): number => {
  const diffTime = Math.abs(date1.getTime() - date2.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const isValidFileType = (mimetype: string): boolean => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/quicktime'
  ];
  return allowedMimes.includes(mimetype);
};
