import type { Metadata } from 'next';
import AdminLoyaltyRuleProduct from '@/components/admin/admin-loyalty-rule-product';
export const metadata:Metadata={title:'Товар у правилі 836 | Pchilka Market'};
export default async function Page({params}:{params:Promise<{productCode:string}>}){const {productCode}=await params;return <AdminLoyaltyRuleProduct productCode={productCode}/>}
