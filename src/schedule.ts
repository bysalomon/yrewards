// UTC mirror of the four monthly withdrawal slots calculated in PostgreSQL.
export function scheduleForMonth(joinDay:number,year:number,month:number):string[]{
 if(!Number.isInteger(joinDay)||joinDay<1||joinDay>31)throw Error('Invalid registration day');
 if(!Number.isInteger(month)||month<1||month>12)throw Error('Invalid calendar month');
 const days=new Date(Date.UTC(year,month,0)).getUTCDate();
 return [1,2,3,4].map(k=>{
  const day=((joinDay-1+7*k)%days)+1;
  return new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10);
 }).sort();
}
