-- Правило 843: центральне сховище одноразових кодів MEGOGO.
-- Виконувати ОДИН раз на центральній базі, яку використовує BonusClient.
-- Не запускати цей файл у локальній базі окремої каси.

create table if not exists pos.megogo_code_843 (
    sequence_no integer primary key check (sequence_no > 0),
    megogo_code varchar(255) not null unique,
    loaded_at timestamp without time zone not null default now()
);

create sequence if not exists pos.seq_megogo_code_843
    start with 1
    increment by 1
    minvalue 1;

-- Після того, як у Google-таблиці будуть коди, завантажити їх у sequence_no
-- від 1 без пропусків. Приклад для трьох кодів:
-- insert into pos.megogo_code_843 (sequence_no, megogo_code) values
--   (1, 'MEGOGO-CODE-1'),
--   (2, 'MEGOGO-CODE-2'),
--   (3, 'MEGOGO-CODE-3');
--
-- Потім перед запуском акції встановити лічильник на перший код:
-- alter sequence pos.seq_megogo_code_843 restart with 1;
--
-- Перевірка залишку кодів:
-- select count(*) as loaded_codes from pos.megogo_code_843;
