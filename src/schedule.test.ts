import {describe,expect,it} from 'vitest';
import {scheduleForMonth} from './schedule';
describe('registration-anchored withdrawal slots',()=>{
 it('keeps days 8, 15, 22 and 29 for members registered on day 1',()=>{
  expect(scheduleForMonth(1,2026,11)).toEqual(['2026-11-08','2026-11-15','2026-11-22','2026-11-29']);
 });
 it('wraps longer join dates in short months and produces four distinct slots',()=>{
  const dates=scheduleForMonth(27,2027,2);
  expect(dates).toEqual(['2027-02-06','2027-02-13','2027-02-20','2027-02-27']);
  expect(new Set(dates).size).toBe(4);
 });
 it('supports leap February and rejects out-of-range dates',()=>{
  expect(scheduleForMonth(1,2028,2)).toEqual(['2028-02-08','2028-02-15','2028-02-22','2028-02-29']);
  expect(()=>scheduleForMonth(32,2028,2)).toThrow();
 });
});
