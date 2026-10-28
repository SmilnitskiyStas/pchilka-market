export type CooperationContact = { id: string; title: string; name: string; email: string; includeInForm: boolean };
export type CooperationDepartment = { id: string; title: string; description: string; imageUrl: string; imageAlt: string; contacts: CooperationContact[] };
export type OfferProductSettings = { pageTitle: string; title: string; intro: string; showForm: boolean; departments: CooperationDepartment[] };

function contact(id: string, title: string, email: string, name: string): CooperationContact {
  return { id, title, email, name, includeInForm: true };
}

export const defaultOfferProductSettings: OfferProductSettings = {
  pageTitle: 'Співпраця', title: 'Запропонувати товар', showForm: true,
  intro: 'Ми зацікавлені у збалансованому асортименті, щоб навіть на невеликій площі забезпечити наявність усіх необхідних товарів та можливість вибору для наших покупців. В наших магазинах є м’ясні та молочні продукти, бакалія, консерви та напівфабрикати, кондитерські вироби, алкогольні і безалкогольні напої. Серед непродовольчих товарів для нас важливими є категорії засобів особистої гігієни, побутової хімії та інших господарських товарів. При виборі постачальників орієнтуємося на високу якість, гарну репутацію, наявність всіх необхідних документів та дозволів. Маєте що запропонувати? Напишіть нашим менеджерам:',
  departments: [
    { id: 'supply', title: 'Відділ постачання', description: '', imageUrl: '/img/cooperation/supply.png', imageAlt: 'Відділ постачання Пчілка маркет', contacts: [
      contact('import', 'Імпорт менеджер', 'import.manager1@legion2015.com', 'Швець Людмила'),
      contact('dairy', 'Молочні вироби, сири, заморозка, морозиво', 'category.manager1@legion2015.com', 'Галицька Альона'),
      contact('grocery', 'Бакалія, сухі сніданки, консервація (солодка, м’ясна, овочева)', 'category.manager2@legion2015.com', 'Курська Мирослава'),
      contact('nonfood', 'Непродовольчі товари', 'category.manager3@legion2015.com', 'Духаніна Ріта'),
      contact('produce', 'Фрукти, овочі', 'category.manager4@legion2015.com', 'Полях Юлія'),
      contact('drinks', 'Алкогольні та безалкогольні напої, тютюнові вироби', 'category.manager5@legion2015.com', 'Муренко Віталій'),
      contact('bakery', 'Хліб, торти, чай, кава, снеки, кондитерські вироби', 'zam.head.manager@legion2015.com', 'Присяжнюк Світлана'),
      contact('sausage', 'Ковбасні вироби, готова та заморожена риба, яйце', 'category.manager7@legion2015.com', 'Грипас Едуард'),
      contact('meat', 'М’ясо', 'category.manager8@legion2015.com', 'Стефанін Денис')
    ] },
    { id: 'production', title: 'Відділ Власного виробництва', description: '', imageUrl: '/img/cooperation/production.png', imageAlt: 'Власне виробництво Пчілка маркет', contacts: [
      contact('head', 'Керівник відділу власного виробництва', 'head.meat@legion2015.com', 'Сокол Роман Олегович'),
      contact('candy', 'Керівник направлення кондитерка', 'head.candy.m23@legion2015.com', 'Семеничева Галина'),
      contact('frozen', 'Керівник направлення заморожені напівфабрикати', 'head.cookery@legion2015.com', 'Лохматова Ірина'),
      contact('bread', 'Керівник направлення пекарня', 'head.bakery@legion2015.com', 'Білогуб Антоніна'),
      contact('cooking', 'Керівник направлення кулінарія', 'technologist3@legion2015.com', 'Сипко Ольга')
    ] },
    { id: 'security', title: 'Відділ безпеки', description: 'Інформацію щодо зловживань та інших правопорушень з боку співробітників Ви маєте можливість направити до Служби безпеки компанії на e-mail:', imageUrl: '/img/cooperation/security.png', imageAlt: 'Служба безпеки Пчілка маркет', contacts: [
      { id: 'security-mail', title: '', name: '', email: 'sb.pchelka@gmail.com', includeInForm: false }
    ] }
  ]
};

export function normalizeOfferProductSettings(raw: unknown): OfferProductSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Невірний формат налаштувань.');
  const input = raw as Record<string, unknown>;
  function text(value: unknown, label: string, max: number, required = false) {
    const result = typeof value === 'string' ? value.trim() : '';
    if (required && !result) throw new Error(`Заповніть поле «${label}».`);
    if (result.length > max) throw new Error(`Поле «${label}» має містити не більше ${max} символів.`);
    return result;
  }
  function id(value: unknown, ids: Set<string>) {
    const result = text(value, 'Ідентифікатор', 80, true);
    if (!/^[a-z0-9_-]+$/i.test(result) || ids.has(result)) throw new Error('Ідентифікатори мають бути унікальними.');
    ids.add(result); return result;
  }
  if (!Array.isArray(input.departments) || input.departments.length > 20) throw new Error('Дозволено до 20 відділів.');
  const departmentIds = new Set<string>();
  const formTitles = new Set<string>();
  const departments = input.departments.map((value) => {
    if (!value || typeof value !== 'object') throw new Error('Невірний формат відділу.');
    const row = value as Record<string, unknown>;
    const imageUrl = text(row.imageUrl, 'Зображення', 2000);
    if (imageUrl && !/^\/(?:img|media|uploads)\//.test(imageUrl)) {
      try { const url = new URL(imageUrl); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { throw new Error('Зображення: оберіть файл із медіафайлів або вкажіть HTTPS-посилання.'); }
    }
    if (!Array.isArray(row.contacts) || row.contacts.length > 100) throw new Error('Дозволено до 100 контактів у відділі.');
    const contactIds = new Set<string>();
    return {
      id: id(row.id, departmentIds), title: text(row.title, 'Назва відділу', 200, true), description: text(row.description, 'Опис відділу', 4000),
      imageUrl, imageAlt: text(row.imageAlt, 'Опис зображення', 300), contacts: row.contacts.map((value) => {
        if (!value || typeof value !== 'object') throw new Error('Невірний формат контакту.');
        const item = value as Record<string, unknown>;
        const email = text(item.email, 'Email', 254, true);
        if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error(`Некоректний email: ${email}`);
        const includeInForm = item.includeInForm === true;
        const title = text(item.title, 'Напрям або посада', 300, includeInForm);
        if (includeInForm && formTitles.has(title.toLowerCase())) throw new Error('Назви напрямів у формі звернення мають бути унікальними.');
        if (includeInForm) formTitles.add(title.toLowerCase());
        return { id: id(item.id, contactIds), title, name: text(item.name, 'Ім’я', 200), email, includeInForm };
      })
    };
  });
  return { pageTitle: text(input.pageTitle, 'Заголовок сторінки', 150, true), title: text(input.title, 'Назва пропозиції', 200, true), intro: text(input.intro, 'Вступ', 8000), showForm: input.showForm === true, departments };
}

export function offerProductCategories(settings: OfferProductSettings) {
  return settings.departments.flatMap((department) => department.contacts.filter((item) => item.includeInForm).map((item) => ({ label: item.title, recipientEmail: item.email, managerName: item.name })));
}
