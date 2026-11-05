export function evaluationMonthCutoff(month){
 if(!month)return '';
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Object.assign(new Error('INVALID_REPORT_MONTH'),{status:400});
 const [year,m]=month.split('-').map(Number);if(year<2000||year>2100)throw Object.assign(new Error('INVALID_REPORT_MONTH'),{status:400});
 return new Date(Date.UTC(year,m,1)-3*3600000).toISOString();
}
export const evaluationCutoffWhere=" WHERE (?='' OR julianday(v.submitted_at)<julianday(?)) ";
