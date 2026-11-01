export const dimensions = ['graduated','graduation_date','education','it_years','employment_history','age','drivers_license','license_restriction','other_qualifications','relocation','travel','start_date'];
export function dayNow() {return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date());}
