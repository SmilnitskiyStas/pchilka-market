import FeedbackTrigger from '@/components/feedback-trigger';
import FooterMenuLinks from '@/components/footer-menu-links';
import { getSiteProfileFromDb } from '@/lib/site-profile-repository';
import { defaultSiteProfileSettings } from '@/lib/site-profile-settings';

const socialIcons = {
  instagram: <><rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17" cy="7" r="1" /></>,
  tiktok: <path d="M14 3h3c0 3 2 5 5 5v3a10 10 0 0 1-5-2v8a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3V3Z" />,
  youtube: <><rect x="2" y="5" width="20" height="14" rx="5" /><path d="m10 9 6 3-6 3Z" fill="white" /></>,
  facebook: <path d="M14 22V13h3l.5-4H14V7c0-1 .3-2 2-2h2V1.4A26 26 0 0 0 15 1c-3 0-5 2-5 5v3H7v4h3v9h4Z" />
};
const socialNames = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook' };
function toTel(phone: string) { return phone.replace(/[^\d+]/g, ''); }

export default async function SiteFooter() {
  const profile = await getSiteProfileFromDb().catch(() => defaultSiteProfileSettings);
  const primaryPhone = profile.contactPhones[0];
  const socialLinks = (Object.keys(socialNames) as (keyof typeof socialNames)[]).filter((key) => profile.socialLinks[key]);

  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div>
          <section><h2>{profile.companyName}</h2><p>Мережа магазинів зі щоденними пропозиціями, програмою лояльності та зручною навігацією по магазинах.</p></section>
          <section className="footer-contacts"><h2>Контакти</h2><address><p>{profile.contactAddress}</p><a className="footer-email" href={`mailto:${profile.contactEmail}`}>{profile.contactEmail}</a>{profile.contactPhones.map((phone) => <a key={phone} href={`tel:${toTel(phone)}`}>{phone}</a>)}</address></section>
        </div>
        <FooterMenuLinks />
        <section><h2>Зворотний зв’язок</h2><a className="footer-primary-phone" href={`tel:${toTel(primaryPhone)}`}>{primaryPhone}</a><FeedbackTrigger />
          {socialLinks.length > 0 ? <div className="footer-social"><h3>Ми в соціальних мережах</h3><div>{socialLinks.map((key) => <a key={key} href={profile.socialLinks[key]} target="_blank" rel="noopener noreferrer" aria-label={socialNames[key]}><svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">{socialIcons[key]}</svg></a>)}</div></div> : null}
        </section>
      </div>
      <p className="footer-copyright">© {new Date().getFullYear()} {profile.companyName}. Всі права захищено.</p>
    </footer>
  );
}
