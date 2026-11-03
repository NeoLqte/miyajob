import {it,expect} from 'vitest';
import {mapAddresses,addressMapURL} from '../AddressText';
it('uses the street address, not a company keyword or floor, in Maps search',()=>{
 const address='静岡県浜松市中央区初生町1254-14';
 expect(mapAddresses(address+' ビル4F')).toEqual([address]);
 const url=new URL(addressMapURL(address));
 expect(url.origin).toBe('https://www.google.com');
 expect(url.searchParams.get('api')).toBe('1');
 expect(url.searchParams.get('query')).toBe(address);
 expect(url.searchParams.has('origin')).toBe(false);
 expect(mapAddresses('天竜区二俣町二俣2396')).toEqual(['浜松市天竜区二俣町二俣2396']);
 expect(mapAddresses('浜松市 中央区 根洗町1536番地の1')).toEqual(['浜松市中央区根洗町1536番地の1']);
});
it('does not guess a street number, city or actual worksite from headquarters',()=>{
 for(const value of ['浜松市中央区','浜松市／案件先未確認','中央区板屋町 浜松アクトタワー18階','東京都 中央区佃1-2','中央区長鶴町158-1'])expect(mapAddresses(value)).toEqual([]);
 expect(mapAddresses('中央区長鶴町158-1','浜松市中央区')).toEqual(['浜松市中央区長鶴町158-1']);
 expect(mapAddresses('採用窓口：磐田市気子島1739-2')).toEqual(['磐田市気子島1739-2']);
});

