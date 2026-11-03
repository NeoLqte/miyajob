import {ExternalLink} from 'lucide-react';
export function mapAddresses(text:string,region=''):string[]{
 const normalized=text.normalize('NFKC').replace(/[−‐‑–—]/g,'-').replace(/(浜松市|磐田市|中央区|浜名区|天竜区)\s+(?=[一-龥])/g,'$1');
 // Require a street number, not a city-only location or a building floor.
 // Ward-only addresses are used in this Hamamatsu catalogue; retain that scope.
 const pattern=/(?:^|[\s：:／/（(、・])((?:静岡県)?(?:浜松市(?:中央区|浜名区|天竜区|中区|東区|西区|南区|北区|浜北区)?|磐田市|浜名区|天竜区|中央区|中区|東区|西区|南区|北区|浜北区)[一-龥々ぁ-んァ-ヶー]+\d+(?:(?:-|丁目|番地?の?|号)\d+)*(?:番地?|号)?)/g;
 return [...new Set([...normalized.matchAll(pattern)].map(m=>m[1]).filter(a=>!/(?:ビル|タワー|センター|事業所|支社|本社|工場)/.test(a)).filter(a=>! /^(?:中央区|中区|東区|西区|南区|北区|浜北区)/.test(a)||region.startsWith('浜松市')).map(a=>/^(?:中央区|浜名区|天竜区|中区|東区|西区|南区|北区|浜北区)/.test(a)?'浜松市'+a:a))];
}
export function addressMapURL(address:string){return 'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:address});}
export default function AddressText({text,region=''}:{text:string;region?:string}){
 const addresses=mapAddresses(text,region);
 return <span>{text}{addresses.map((address,i)=><a className="address-map-link" key={address} href={addressMapURL(address)} target="_blank" rel="noopener noreferrer" aria-label={`Google マップで住所を開く：${address}`} title={`記載住所：${address}。実際の配属先の確定とは別です。`}> Google マップ{addresses.length>1?` ${i+1}`:''}<ExternalLink size={12}/></a>)}</span>;
}

