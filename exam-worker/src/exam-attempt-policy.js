export const unlimitedExam=exam=>Number(exam.max_attempts)===0;
export function remainingAttempts(exam,count,extra=0){return unlimitedExam(exam)?null:Math.max(0,Number(exam.max_attempts)+(Number(extra)||0)-count);}
export function attemptExpiry(now,closes,durationMinutes){return new Date(Math.min(closes.getTime(),now.getTime()+durationMinutes*60000));}
