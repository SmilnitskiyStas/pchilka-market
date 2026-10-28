import type { Metadata } from 'next';
import CooperationOfferForm from '@/components/cooperation-offer-form';
import { getOfferProductSettings } from '@/lib/offer-product-repository';
import { defaultOfferProductSettings, offerProductCategories } from '@/lib/offer-product-settings';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const content = await getOfferProductSettings().catch(() => defaultOfferProductSettings);
  return { title: content.title + ' | Pchilka Market', description: content.intro.slice(0, 160) };
}
export default async function OfferProductPage() {
  const content = await getOfferProductSettings().catch(() => defaultOfferProductSettings);
  const categories = offerProductCategories(content);
  return <div className="cooperation-product-screen"><main className="site-container cooperation-product-page">
    <h1>{content.pageTitle}</h1>
    <header className="cooperation-product-intro"><h2>{content.title}</h2><p>{content.intro}</p></header>
    <div className="cooperation-departments">
      {content.departments.map((department) => <section className="cooperation-department" key={department.id} aria-labelledby={'department-' + department.id}>
        <h2 id={'department-' + department.id}>{department.title}</h2>
        {department.imageUrl ? <img src={department.imageUrl} alt={department.imageAlt} className="cooperation-department-art" loading="lazy" /> : null}
        {department.description ? <p className="cooperation-department-description">{department.description}</p> : null}
        {department.contacts.map((contact) => <div className="cooperation-contact" key={contact.id}>
          {contact.title ? <h3>{contact.title}</h3> : null}
          <a href={'mailto:' + contact.email}>{contact.email}</a>
          {contact.name ? <p>{contact.name}</p> : null}
        </div>)}
      </section>)}
    </div>
    {content.showForm && categories.length ? <section className="cooperation-product-form"><CooperationOfferForm mode="product" productCategories={categories} storageKey="cooperation_offer_product_requests" submitButtonLabel="Сформувати лист" /></section> : null}
  </main></div>;
}
